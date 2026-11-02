jest.mock('../services/leave.service', () => ({
  rejectLeave: jest.fn()
}));
jest.mock('../models/leave.model', () => ({
  getLeaveById: jest.fn(),
  approveLeave: jest.fn()
}));
jest.mock('../models/leaveEntitlement.model', () => ({}));
jest.mock('../models/user.model', () => ({}));
jest.mock('../models/notification.model', () => ({
  createNotification: jest.fn()
}));
jest.mock('../config/db', () => ({
  query: jest.fn()
}));

const leaveService = require('../services/leave.service');
const leaveModel = require('../models/leave.model');
const db = require('../config/db');
const controller = require('./leave.controller');

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return response;
};

describe('HOD leave approval department scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    leaveModel.getLeaveById.mockResolvedValue({
      id: 7,
      user_id: 22,
      status: 'Pending',
      from_date: '2026-11-02',
      to_date: '2026-11-03'
    });
  });

  test('prevents approval for an employee in another department', async () => {
    db.query.mockResolvedValue({
      rows: [{
        applicant_role: 'Employee',
        applicant_department_id: 9,
        approver_department_id: 4
      }]
    });
    const response = createResponse();

    await controller.approveLeave({
      params: { id: '7' },
      user: { userId: 11, role: 'HOD' }
    }, response, jest.fn());

    expect(response.statusCode).toBe(403);
    expect(leaveModel.approveLeave).not.toHaveBeenCalled();
  });

  test('prevents rejection for an employee in another department', async () => {
    db.query.mockResolvedValue({
      rows: [{
        applicant_role: 'Employee',
        applicant_department_id: 9,
        approver_department_id: 4
      }]
    });
    const response = createResponse();

    await controller.rejectLeave({
      params: { id: '7' },
      user: { userId: 11, role: 'HOD' }
    }, response, jest.fn());

    expect(response.statusCode).toBe(403);
    expect(leaveService.rejectLeave).not.toHaveBeenCalled();
  });

  test('allows approval for an employee in the HOD department', async () => {
    db.query.mockResolvedValue({
      rows: [{
        applicant_role: 'Employee',
        applicant_department_id: 4,
        approver_department_id: '4'
      }]
    });
    leaveModel.approveLeave.mockResolvedValue({ id: 7, status: 'Approved' });
    const response = createResponse();

    await controller.approveLeave({
      params: { id: '7' },
      user: { userId: 11, role: 'HOD' }
    }, response, jest.fn());

    expect(response.statusCode).toBe(200);
    expect(leaveModel.approveLeave).toHaveBeenCalledWith(7, 11);
  });

  test('allows rejection for an employee in the HOD department', async () => {
    db.query.mockResolvedValue({
      rows: [{
        applicant_role: 'Employee',
        applicant_department_id: 4,
        approver_department_id: 4
      }]
    });
    leaveService.rejectLeave.mockResolvedValue({ id: 7, status: 'Rejected' });
    const response = createResponse();

    await controller.rejectLeave({
      params: { id: '7' },
      user: { userId: 11, role: 'HOD' }
    }, response, jest.fn());

    expect(response.statusCode).toBe(200);
    expect(leaveService.rejectLeave).toHaveBeenCalledWith(7, 11);
  });

  test('preserves management approval across departments', async () => {
    db.query.mockResolvedValue({
      rows: [{
        applicant_role: 'Employee',
        applicant_department_id: 9,
        approver_department_id: 4
      }]
    });
    leaveModel.approveLeave.mockResolvedValue({ id: 7, status: 'Approved' });
    const response = createResponse();

    await controller.approveLeave({
      params: { id: '7' },
      user: { userId: 11, role: 'Management' }
    }, response, jest.fn());

    expect(response.statusCode).toBe(200);
    expect(leaveModel.approveLeave).toHaveBeenCalledWith(7, 11);
  });

  test('denies HOD approval if either department is missing', async () => {
    db.query.mockResolvedValue({
      rows: [{
        applicant_role: 'Employee',
        applicant_department_id: null,
        approver_department_id: 4
      }]
    });
    const response = createResponse();

    await controller.approveLeave({
      params: { id: '7' },
      user: { userId: 11, role: 'HOD' }
    }, response, jest.fn());

    expect(response.statusCode).toBe(403);
    expect(leaveModel.approveLeave).not.toHaveBeenCalled();
  });
});
