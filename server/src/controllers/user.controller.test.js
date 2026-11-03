jest.mock('../models/user.model', () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserByEmpid: jest.fn(),
  getUsersByDepartment: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  findUserWithPasswordById: jest.fn()
}));
jest.mock('../utils/hash', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn()
}));
jest.mock('../models/notification.model', () => ({
  createNotification: jest.fn().mockResolvedValue({})
}));

const userModel = require('../models/user.model');
const controller = require('./user.controller');

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

describe('getUserById personal data access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns only public profile fields to an employee in another department', async () => {
    userModel.findUserById.mockResolvedValue({
      id: 2,
      email: 'person@example.com',
      empid: 202,
      firstname: 'Taylor',
      middlename: 'A',
      lastname: 'User',
      phone: '555-0100',
      address: 'Private address',
      bloodgroup: 'O+',
      department_id: 8,
      staff_photo: '/api/uploads/users/photo.jpg'
    });
    const response = createResponse();

    await controller.getUserById({
      params: { id: 2 },
      user: { userId: 1, role: 'Employee' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 2,
      firstname: 'Taylor',
      middlename: 'A',
      lastname: 'User',
      department_id: 8
    });
    expect(response.body.data).not.toHaveProperty('email');
    expect(response.body.data).not.toHaveProperty('empid');
    expect(response.body.data).not.toHaveProperty('phone');
    expect(response.body.data).not.toHaveProperty('address');
    expect(response.body.data).not.toHaveProperty('bloodgroup');
  });

  test('allows an HOD to see full details within their own department', async () => {
    userModel.findUserById
      .mockResolvedValueOnce({
        id: 2,
        firstname: 'Taylor',
        lastname: 'User',
        email: 'person@example.com',
        phone: '555-0100',
        department_id: 8
      })
      .mockResolvedValueOnce({ id: 1, department_id: 8 });
    const response = createResponse();

    await controller.getUserById({
      params: { id: 2 },
      user: { userId: 1, role: 'HOD' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toHaveProperty('email', 'person@example.com');
    expect(response.body.data).toHaveProperty('phone', '555-0100');
  });
});

describe('getUsersByDepartment access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prevents an HOD from querying another department', async () => {
    userModel.findUserById.mockResolvedValue({ id: 1, department_id: 8 });
    const response = createResponse();

    await controller.getUsersByDepartment({
      params: { id: 9 },
      user: { userId: 1, role: 'HOD' }
    }, response);

    expect(response.statusCode).toBe(403);
    expect(userModel.getUsersByDepartment).not.toHaveBeenCalled();
  });
});

describe('updateMyProfile organization fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ignores submitted department and designation changes', async () => {
    userModel.findUserById.mockResolvedValue({
      id: 1,
      email: 'person@example.com',
      staff_photo: null
    });
    userModel.findUserByEmail.mockResolvedValue(null);
    userModel.updateUser.mockResolvedValue({ id: 1, firstname: 'Taylor' });
    const response = createResponse();

    await controller.updateMyProfile({
      user: { userId: 1 },
      body: {
        firstName: 'Taylor',
        lastName: 'User',
        email: 'person@example.com',
        departmentId: 99,
        designationId: 88
      }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(userModel.updateUser).toHaveBeenCalledWith(1, expect.not.objectContaining({
      department_id: expect.anything(),
      designation_id: expect.anything()
    }));
    expect(userModel.updateUser.mock.calls[0][1]).not.toHaveProperty('department_id');
    expect(userModel.updateUser.mock.calls[0][1]).not.toHaveProperty('designation_id');
  });
});

// Security regression tests for audit finding M4: changing your own email
// (where password reset codes are sent) needs the current password.
describe('updateMyProfile email change requires the current password', () => {
  const { comparePassword } = require('../utils/hash');

  const submit = async (body) => {
    const response = createResponse();
    await controller.updateMyProfile({
      user: { userId: 1 },
      body: { firstName: 'Taylor', lastName: 'User', ...body }
    }, response);
    return response;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userModel.findUserById.mockResolvedValue({ id: 1, email: 'person@example.com', staff_photo: null });
    userModel.findUserByEmail.mockResolvedValue(null);
    userModel.findUserWithPasswordById.mockResolvedValue({ id: 1, password: 'stored-hash' });
    userModel.updateUser.mockResolvedValue({ id: 1 });
  });

  test('rejects an email change without the current password', async () => {
    const response = await submit({ email: 'attacker@example.com' });

    expect(response.statusCode).toBe(400);
    expect(userModel.updateUser).not.toHaveBeenCalled();
  });

  test('rejects an email change with a wrong password', async () => {
    comparePassword.mockResolvedValue(false);

    const response = await submit({ email: 'attacker@example.com', currentPassword: 'guess' });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe('Current password is incorrect');
    expect(userModel.updateUser).not.toHaveBeenCalled();
  });

  test('allows an email change with the correct password', async () => {
    comparePassword.mockResolvedValue(true);

    const response = await submit({ email: 'new@example.com', currentPassword: 'right' });

    expect(response.statusCode).toBe(200);
    expect(comparePassword).toHaveBeenCalledWith('right', 'stored-hash');
    expect(userModel.updateUser.mock.calls[0][1].email).toBe('new@example.com');
  });

  test('other profile changes still need no password', async () => {
    const response = await submit({ email: 'person@example.com', phone: '12345' });

    expect(response.statusCode).toBe(200);
    expect(comparePassword).not.toHaveBeenCalled();
  });
});

describe('Management role management permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('allows Management to create Admin users', async () => {
    userModel.findUserByEmail.mockResolvedValue(null);
    userModel.findUserByEmpid.mockResolvedValue(null);
    userModel.createUser.mockResolvedValue({ id: 2, role: 'Admin' });
    const response = createResponse();

    await controller.createUser({
      user: { userId: 1, role: 'Management' },
      body: {
        email: 'admin@example.com',
        password: 'StrongPass123',
        firstName: 'New',
        lastName: 'Admin',
        role: 'Admin'
      }
    }, response);

    expect(response.statusCode).toBe(201);
    expect(userModel.createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'Admin' }));
  });

  test('allows Management to assign a role through user updates', async () => {
    userModel.findUserById.mockResolvedValue({ id: 2, staff_photo: null });
    userModel.updateUser.mockResolvedValue({ id: 2, role: 'Admin' });
    const response = createResponse();

    await controller.updateUser({
      params: { id: '2' },
      user: { userId: 1, role: 'Management' },
      body: { role: 'Admin' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(userModel.updateUser).toHaveBeenCalledWith('2', { role: 'Admin' });
  });
});

describe('user password updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('passes a new password to the model for a single hash operation', async () => {
    userModel.findUserById.mockResolvedValue({
      id: 2,
      email: 'person@example.com',
      staff_photo: null
    });
    userModel.updateUser.mockResolvedValue({ id: 2 });
    const response = createResponse();

    await controller.updateUser({
      params: { id: '2' },
      user: { userId: 1, role: 'Admin' },
      body: { password: 'StrongPass123' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(userModel.updateUser).toHaveBeenCalledWith('2', { password: 'StrongPass123' });
  });
});
