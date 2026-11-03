jest.mock('../config/db', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../models/leave.model', () => ({
  getLeaveById: jest.fn(),
  updateLeave: jest.fn()
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
