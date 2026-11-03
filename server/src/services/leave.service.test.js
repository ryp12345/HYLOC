jest.mock('../config/db', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../models/leave.model', () => ({
  getLeaveById: jest.fn(),
  updateLeave: jest.fn(),
  deleteLeave: jest.fn()
}));
jest.mock('../models/leaveEntitlement.model', () => ({
  getLeaveBalance: jest.fn(),
  updateLeavesAvailed: jest.fn()
}));

const db = require('../config/db');
const leaveModel = require('../models/leave.model');
const entitlementModel = require('../models/leaveEntitlement.model');
const leaveService = require('./leave.service');

// Security regression tests for PUT /api/leaves/:id (audit finding H1)
describe('updatePendingLeave: approval cannot be bypassed', () => {
  const OWNER_ID = 7;
  const HOD_ID = 20;
  const MANAGEMENT_ID = 30;
  const HR_ID = 40;

  let client;
  let hodContext;

  const leave = (overrides = {}) => ({
    id: 42,
    user_id: OWNER_ID,
    user_role: 'Employee',
    status: 'Pending',
    leave_type: 'Earned Leave',
    leave_duration: 'Full Day',
    from_date: '2026-12-01',
    to_date: '2026-12-03',
    credited_days: 3,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    hodContext = { applicant_role: 'Employee', applicant_department_id: 1, approver_department_id: 1 };
    client = {
      query: jest.fn(async (sql) => (
        String(sql).includes('applicant_department_id') ? { rows: [hodContext] } : { rows: [] }
      )),
      release: jest.fn()
    };
    db.connect.mockResolvedValue(client);
    leaveModel.getLeaveById.mockResolvedValue(leave());
    leaveModel.updateLeave.mockImplementation(async (id, fields) => ({ ...leave(), ...fields }));
    entitlementModel.getLeaveBalance.mockResolvedValue({ leave_balance: 100 });
  });

  const update = (userId, role, body) => leaveService.updatePendingLeave(42, userId, body, role);

  test('an employee cannot approve their own leave', async () => {
    await expect(update(OWNER_ID, 'Employee', { status: 'Approved' }))
      .rejects.toThrow(/Forbidden/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('HOD and Management cannot approve their own leave either', async () => {
    leaveModel.getLeaveById.mockResolvedValue(leave({ user_id: MANAGEMENT_ID, user_role: 'Management' }));
    await expect(update(MANAGEMENT_ID, 'Management', { status: 'Approved' })).rejects.toThrow(/Forbidden/);

    leaveModel.getLeaveById.mockResolvedValue(leave({ user_id: HOD_ID, user_role: 'HOD' }));
    await expect(update(HOD_ID, 'HOD', { status: 'Approved' })).rejects.toThrow(/Forbidden/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('server-controlled fields in the request body are ignored', async () => {
    await update(OWNER_ID, 'Employee', {
      leave_reason: 'Family function',
      credited_days: 0,
      approved_by: HOD_ID,
      rejection_reason: 'x'
    });

    const written = leaveModel.updateLeave.mock.calls[0][1];
    expect(written).toEqual({ leave_reason: 'Family function' });
  });

  test('approved or rejected leaves cannot be edited without "request change"', async () => {
    leaveModel.getLeaveById.mockResolvedValue(leave({ status: 'Approved' }));
    await expect(update(OWNER_ID, 'Employee', { leave_reason: 'changed' }))
      .rejects.toThrow(/pending/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('HR cannot change leave status (not an approver)', async () => {
    await expect(update(HR_ID, 'HR', { status: 'Approved' })).rejects.toThrow(/Forbidden/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('HOD cannot decide leaves from another department', async () => {
    hodContext.approver_department_id = 2;
    await expect(update(HOD_ID, 'HOD', { status: 'Approved' })).rejects.toThrow(/Forbidden/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  // Audit finding M2: editing details must follow the same department rule
  test('HOD cannot edit details of an Employee leave in another department', async () => {
    hodContext.applicant_department_id = 2;
    await expect(update(HOD_ID, 'HOD', { from_date: '2026-12-02', leave_reason: 'changed' }))
      .rejects.toThrow(/Forbidden/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
    expect(entitlementModel.updateLeavesAvailed).not.toHaveBeenCalled();
  });

  test('HOD cannot edit details when the HOD has no department', async () => {
    hodContext.approver_department_id = null;
    await expect(update(HOD_ID, 'HOD', { leave_reason: 'changed' })).rejects.toThrow(/Forbidden/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('HOD cannot edit details of a Management leave', async () => {
    hodContext.applicant_role = 'Management';
    await expect(update(HOD_ID, 'HOD', { leave_reason: 'changed' })).rejects.toThrow(/Forbidden/);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('HOD can still edit details of an Employee leave in their own department', async () => {
    await update(HOD_ID, 'HOD', { leave_reason: 'changed' });
    expect(leaveModel.updateLeave.mock.calls[0][1]).toEqual({ leave_reason: 'changed' });
  });

  test('HR and Management can still edit details of any pending leave (unchanged)', async () => {
    hodContext.applicant_department_id = 2;
    await update(HR_ID, 'HR', { leave_reason: 'by HR' });
    await update(MANAGEMENT_ID, 'Management', { leave_reason: 'by Mgmt' });
    expect(leaveModel.updateLeave).toHaveBeenCalledTimes(2);
  });

  test('HOD can approve an Employee leave in their department; approver is recorded server-side', async () => {
    await update(HOD_ID, 'HOD', { status: 'Approved', approved_by: 999 });

    expect(leaveModel.updateLeave.mock.calls[0][1]).toEqual({ status: 'Approved', approved_by: HOD_ID });
  });

  test('Management can permit a change (Approved -> Pending) on someone else\'s leave', async () => {
    leaveModel.getLeaveById.mockResolvedValue(leave({ status: 'Approved' }));

    await update(MANAGEMENT_ID, 'Management', { status: 'Pending' });

    expect(leaveModel.updateLeave.mock.calls[0][1]).toEqual({ status: 'Pending' });
  });

  test('unknown statuses are rejected with 400', async () => {
    await expect(update(MANAGEMENT_ID, 'Management', { status: 'Cancelled' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('status and details cannot be changed in one request', async () => {
    await expect(update(MANAGEMENT_ID, 'Management', { status: 'Approved', to_date: '2026-12-31' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('saving the same status with no other changes is a harmless no-op', async () => {
    const result = await update(HOD_ID, 'HOD', { status: 'Pending' });

    expect(result.id).toBe(42);
    expect(leaveModel.updateLeave).not.toHaveBeenCalled();
  });

  test('the owner can still edit details of a pending leave', async () => {
    await update(OWNER_ID, 'Employee', { status: 'Pending', leave_reason: 'Updated reason' });

    expect(leaveModel.updateLeave.mock.calls[0][1]).toEqual({ leave_reason: 'Updated reason' });
  });
});

// Security regression tests for DELETE /api/leaves/:id (audit finding H3)
describe('cancelLeave: approved leave cannot be erased', () => {
  const OWNER_ID = 7;
  const HOD_ID = 20;
  const MANAGEMENT_ID = 30;
  const HR_ID = 40;

  let client;
  let hodContext;

  const leave = (overrides = {}) => ({
    id: 42,
    user_id: OWNER_ID,
    user_role: 'Employee',
    status: 'Pending',
    leave_type: 'Earned Leave',
    leave_duration: 'Full Day',
    from_date: '2026-12-01',
    to_date: '2026-12-03',
    credited_days: 3,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    hodContext = { applicant_role: 'Employee', applicant_department_id: 1, approver_department_id: 1 };
    client = {
      query: jest.fn(async (sql) => (
        String(sql).includes('applicant_department_id') ? { rows: [hodContext] } : { rows: [] }
      )),
      release: jest.fn()
    };
    db.connect.mockResolvedValue(client);
  });

  const cancel = (status, actorId, role, extra = {}) => {
    leaveModel.getLeaveById.mockResolvedValue(leave({ status, ...extra }));
    return leaveService.cancelLeave(42, actorId, role);
  };

  test.each(['Approved', 'Rejected'])('the owner cannot cancel a %s leave', async (status) => {
    await expect(cancel(status, OWNER_ID, 'Employee')).rejects.toThrow('Only pending leaves can be cancelled');
    expect(leaveModel.deleteLeave).not.toHaveBeenCalled();
    expect(entitlementModel.updateLeavesAvailed).not.toHaveBeenCalled();
  });

  test('the owner can still cancel a pending leave and gets the days back', async () => {
    await cancel('Pending', OWNER_ID, 'Employee');

    expect(leaveModel.deleteLeave).toHaveBeenCalledWith(42, client);
    expect(entitlementModel.updateLeavesAvailed).toHaveBeenCalledWith(OWNER_ID, 2026, -3, client);
  });

  test('an employee cannot cancel someone else\'s leave', async () => {
    await expect(cancel('Pending', 99, 'Employee')).rejects.toThrow(/Forbidden/);
    expect(leaveModel.deleteLeave).not.toHaveBeenCalled();
  });

  test('HOD cannot cancel leave from another department', async () => {
    hodContext.applicant_department_id = 2;
    await expect(cancel('Pending', HOD_ID, 'HOD')).rejects.toThrow(/Forbidden/);
    expect(leaveModel.deleteLeave).not.toHaveBeenCalled();
  });

  test('HOD cannot cancel a Management or HOD leave', async () => {
    hodContext.applicant_role = 'Management';
    await expect(cancel('Pending', HOD_ID, 'HOD')).rejects.toThrow(/Forbidden/);
    expect(leaveModel.deleteLeave).not.toHaveBeenCalled();
  });

  test('HOD cannot cancel an approved leave, even in their department', async () => {
    await expect(cancel('Approved', HOD_ID, 'HOD')).rejects.toThrow('Only pending leaves can be cancelled');
    expect(leaveModel.deleteLeave).not.toHaveBeenCalled();
  });

  test('HOD can cancel a pending Employee leave in their department', async () => {
    await cancel('Pending', HOD_ID, 'HOD');
    expect(leaveModel.deleteLeave).toHaveBeenCalledWith(42, client);
  });

  test.each([[MANAGEMENT_ID, 'Management'], [HR_ID, 'HR']])(
    'user %s with role %s can still cancel an approved leave (unchanged)',
    async (actorId, role) => {
      await cancel('Approved', actorId, role);
      expect(leaveModel.deleteLeave).toHaveBeenCalledWith(42, client);
    }
  );
});
