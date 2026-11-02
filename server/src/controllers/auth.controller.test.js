jest.mock('../services/auth.service', () => ({
  getUserById: jest.fn(),
  getActiveRoles: jest.fn(),
  login: jest.fn()
}));
jest.mock('../models/user.model', () => ({
  findUserByEmail: jest.fn(),
  updateUser: jest.fn()
}));
jest.mock('../models/passwordReset.model', () => ({
  findActiveRequest: jest.fn(),
  recordFailedAttempt: jest.fn(),
  consumeRequest: jest.fn()
}));
jest.mock('../models/loginAttempt.model', () => ({
  clear: jest.fn()
}));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));

const authService = require('../services/auth.service');
const UserModel = require('../models/user.model');
const passwordResetModel = require('../models/passwordReset.model');
const loginAttemptModel = require('../models/loginAttempt.model');
const bcrypt = require('bcryptjs');
const controller = require('./auth.controller');

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
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

describe('login messages', () => {
  beforeEach(() => jest.clearAllMocks());

  test('explains a locked account with the time left', async () => {
    const lockError = Object.assign(new Error('Account temporarily locked'), {
      code: 'ACCOUNT_LOCKED',
      retryAfterSeconds: 14 * 60 + 5
    });
    authService.login.mockRejectedValue(lockError);
    const response = createResponse();

    await controller.login({ body: { empid: '500', password: 'x' } }, response);

    expect(response.statusCode).toBe(423);
    expect(response.headers['Retry-After']).toBe(String(14 * 60 + 5));
    expect(response.body.message).toContain('temporarily locked');
    expect(response.body.message).toContain('15 minutes');
    expect(response.body.errors.code).toBe('ACCOUNT_LOCKED');
  });

  test('uses the singular for one minute left', async () => {
    authService.login.mockRejectedValue(Object.assign(new Error('locked'), {
      code: 'ACCOUNT_LOCKED',
      retryAfterSeconds: 20
    }));
    const response = createResponse();

    await controller.login({ body: { empid: '500', password: 'x' } }, response);

    expect(response.body.message).toContain('1 minute,');
  });

  test('explains an inactive account', async () => {
    authService.login.mockRejectedValue(Object.assign(new Error('Account inactive'), {
      code: 'ACCOUNT_INACTIVE'
    }));
    const response = createResponse();

    await controller.login({ body: { empid: '500', password: 'x' } }, response);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toContain('inactive');
    expect(response.body.errors.code).toBe('ACCOUNT_INACTIVE');
  });

  test('keeps a generic message for wrong credentials', async () => {
    authService.login.mockRejectedValue(new Error('Invalid employee ID or password'));
    const response = createResponse();

    await controller.login({ body: { empid: '500', password: 'x' } }, response);

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Invalid employee ID or password');
  });
});

describe('password reset unlocks the account', () => {
  test('clears the login lock after a successful reset', async () => {
    UserModel.findUserByEmail.mockResolvedValue({ id: 5 });
    passwordResetModel.findActiveRequest.mockResolvedValue({ id: 9, otp_hash: 'hash' });
    passwordResetModel.consumeRequest.mockResolvedValue(true);
    bcrypt.compare.mockResolvedValue(true);
    const response = createResponse();

    await controller.resetPassword({
      body: { email: 'person@example.com', otp: '123456', newPassword: 'new-password-1' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(loginAttemptModel.clear).toHaveBeenCalledWith(5);
  });
});

describe('getProfile role', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authService.getUserById.mockResolvedValue({
      id: 1,
      email: 'person@example.com',
      firstname: 'Taylor',
      lastname: 'User',
      empid: 10000
    });
  });

  test('returns the authenticated active role instead of deriving it from user identity', async () => {
    authService.getActiveRoles.mockResolvedValue(['Admin', 'Employee']);
    const response = createResponse();

    await controller.getProfile({
      user: { userId: 1, role: 'Employee' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.role).toBe('Employee');
  });

  test('falls back to an active assigned role when the token role is no longer active', async () => {
    authService.getActiveRoles.mockResolvedValue(['Management']);
    const response = createResponse();

    await controller.getProfile({
      user: { userId: 1, role: 'Admin' }
    }, response);

    expect(response.body.data.role).toBe('Management');
  });
});
