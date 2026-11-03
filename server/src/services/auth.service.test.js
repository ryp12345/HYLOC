jest.mock('../models/user.model', () => ({
  findUserByEmpid: jest.fn(),
  findUserById: jest.fn(),
  getActiveRoles: jest.fn()
}));
jest.mock('../models/loginAttempt.model', () => ({
  getLockSecondsRemaining: jest.fn(),
  recordFailure: jest.fn(),
  clear: jest.fn()
}));
jest.mock('../utils/hash', () => ({
  comparePassword: jest.fn()
}));
jest.mock('../utils/jwt', () => ({
  generateAccessToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn()
}));
jest.mock('../config/db', () => ({ query: jest.fn() }));

const db = require('../config/db');
const UserModel = require('../models/user.model');
const loginAttemptModel = require('../models/loginAttempt.model');
const { comparePassword } = require('../utils/hash');
const jwt = require('../utils/jwt');
const authService = require('./auth.service');

describe('login lockout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UserModel.findUserByEmpid.mockResolvedValue({ id: 5, password: 'stored-hash', status: 'active' });
  });

  test('rejects a locked account without checking its password', async () => {
    loginAttemptModel.getLockSecondsRemaining.mockResolvedValue(600);

    await expect(authService.login('500', 'password')).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      retryAfterSeconds: 600
    });

    expect(comparePassword).not.toHaveBeenCalled();
    expect(loginAttemptModel.recordFailure).not.toHaveBeenCalled();
  });

  test('records an incorrect password for persistent lockout', async () => {
    loginAttemptModel.getLockSecondsRemaining.mockResolvedValue(0);
    loginAttemptModel.recordFailure.mockResolvedValue(0);
    comparePassword.mockResolvedValue(false);

    await expect(authService.login('500', 'wrong')).rejects.toThrow('Invalid employee ID or password');

    expect(loginAttemptModel.recordFailure).toHaveBeenCalledWith(5);
    expect(loginAttemptModel.clear).not.toHaveBeenCalled();
  });

  test('reports the lock on the failure that triggers it', async () => {
    loginAttemptModel.getLockSecondsRemaining.mockResolvedValue(0);
    loginAttemptModel.recordFailure.mockResolvedValue(900);
    comparePassword.mockResolvedValue(false);

    await expect(authService.login('500', 'wrong')).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      retryAfterSeconds: 900
    });
  });

  test('tells the owner of an inactive account once their password is correct', async () => {
    UserModel.findUserByEmpid.mockResolvedValue({ id: 5, password: 'stored-hash', status: 'inactive' });
    comparePassword.mockResolvedValue(true);

    await expect(authService.login('500', 'right')).rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });

  test('gives the generic message for an inactive account with a wrong password', async () => {
    UserModel.findUserByEmpid.mockResolvedValue({ id: 5, password: 'stored-hash', status: 'inactive' });
    comparePassword.mockResolvedValue(false);

    await expect(authService.login('500', 'wrong')).rejects.toThrow('Invalid employee ID or password');
    expect(loginAttemptModel.recordFailure).not.toHaveBeenCalled();
  });

  test('does not reveal a lock for unknown employee IDs', async () => {
    UserModel.findUserByEmpid.mockResolvedValue(undefined);

    await expect(authService.login('999', 'wrong')).rejects.toThrow('Invalid employee ID or password');
    expect(loginAttemptModel.getLockSecondsRemaining).not.toHaveBeenCalled();
  });

  test('rejects refresh tokens issued before a password or status change', async () => {
    jwt.verifyRefreshToken.mockReturnValue({ userId: 5, tokenVersion: 1 });
    UserModel.findUserById.mockResolvedValue({
      id: 5,
      status: 'active',
      token_version: 2
    });

    await expect(authService.refreshAccessToken('refresh-token')).rejects.toThrow('User not found');
    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });

  test('rejects refresh tokens for deactivated accounts', async () => {
    jwt.verifyRefreshToken.mockReturnValue({ userId: 5, tokenVersion: 1 });
    UserModel.findUserById.mockResolvedValue({
      id: 5,
      status: 'inactive',
      token_version: 1
    });

    await expect(authService.refreshAccessToken('refresh-token')).rejects.toThrow('User not found');
    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });
});

describe('token role ignores deactivated roles', () => {
  // User 5's oldest role (Admin) was set to Inactive; Employee is still active.
  const userRoleRows = [
    { id: 1, role_name: 'Admin', status: 'inactive' },
    { id: 2, role_name: 'Employee', status: 'active' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Answer the role query like the database would, honouring a status filter if present
    db.query.mockImplementation(async (sql) => {
      const onlyActive = /ur\.status\s*=\s*'active'/.test(sql);
      const rows = userRoleRows
        .filter((row) => !onlyActive || row.status === 'active')
        .sort((a, b) => a.id - b.id)
        .slice(0, 1)
        .map(({ role_name }) => ({ role_name }));
      return { rows };
    });
  });

  test('login does not issue an inactive role', async () => {
    UserModel.findUserByEmpid.mockResolvedValue({ id: 5, email: 'x@y.z', password: 'stored-hash', status: 'active', token_version: 0 });
    loginAttemptModel.getLockSecondsRemaining.mockResolvedValue(0);
    comparePassword.mockResolvedValue(true);

    const result = await authService.login('500', 'correct');

    expect(result.user.role).toBe('Employee');
    expect(jwt.generateAccessToken).toHaveBeenCalledWith(5, 'x@y.z', 'Employee', 0);
  });

  test('refresh does not fall back to an inactive role', async () => {
    jwt.verifyRefreshToken.mockReturnValue({ userId: 5, tokenVersion: 0 });
    UserModel.findUserById.mockResolvedValue({ id: 5, email: 'x@y.z', status: 'active', token_version: 0 });
    UserModel.getActiveRoles.mockResolvedValue(['Employee']);

    await authService.refreshAccessToken('refresh-token', 'Admin');

    expect(jwt.generateAccessToken).toHaveBeenCalledWith(5, 'x@y.z', 'Employee', 0);
  });

  test('login gives Employee when the user has no active role left', async () => {
    userRoleRows[1].status = 'inactive';
    UserModel.findUserByEmpid.mockResolvedValue({ id: 5, email: 'x@y.z', password: 'stored-hash', status: 'active', token_version: 0 });
    loginAttemptModel.getLockSecondsRemaining.mockResolvedValue(0);
    comparePassword.mockResolvedValue(true);

    const result = await authService.login('500', 'correct');
    userRoleRows[1].status = 'active';

    expect(result.user.role).toBe('Employee');
  });
});
