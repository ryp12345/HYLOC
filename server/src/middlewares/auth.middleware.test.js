jest.mock('../utils/jwt', () => ({
  verifyAccessToken: jest.fn()
}));
jest.mock('../models/user.model', () => ({
  findUserById: jest.fn()
}));

const { verifyAccessToken } = require('../utils/jwt');
const userModel = require('../models/user.model');
const { authenticate, authenticateAllowPasswordChange } = require('./auth.middleware');

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

describe('access token revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockReturnValue({
      userId: 5,
      role: 'Employee',
      tokenVersion: 2
    });
  });

  test('rejects access tokens issued before a password or status update', async () => {
    userModel.findUserById.mockResolvedValue({
      id: 5,
      status: 'active',
      token_version: 3
    });
    const response = createResponse();
    const next = jest.fn();

    await authenticate({ headers: { authorization: 'Bearer access-token' } }, response, next);

    expect(response.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts a current access token for an active account', async () => {
    userModel.findUserById.mockResolvedValue({
      id: 5,
      status: 'active',
      token_version: 2
    });
    const response = createResponse();
    const next = jest.fn();

    await authenticate({ headers: { authorization: 'Bearer access-token' } }, response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects an access token for a deactivated account', async () => {
    userModel.findUserById.mockResolvedValue({
      id: 5,
      status: 'inactive',
      token_version: 2
    });
    const response = createResponse();
    const next = jest.fn();

    await authenticate({ headers: { authorization: 'Bearer access-token' } }, response, next);

    expect(response.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('mandatory password change', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyAccessToken.mockReturnValue({ userId: 5, role: 'Employee', tokenVersion: 2 });
  });

  const run = async (middleware, mustChange) => {
    userModel.findUserById.mockResolvedValue({ id: 5, status: 'active', token_version: 2, must_change_password: mustChange });
    const response = createResponse();
    const next = jest.fn();
    await middleware({ headers: { authorization: 'Bearer access-token' } }, response, next);
    return { response, next };
  };

  test('blocks normal APIs while a temporary password is pending', async () => {
    const { response, next } = await run(authenticate, true);
    expect(response.statusCode).toBe(403);
    expect(response.body.errors).toEqual({ code: 'PASSWORD_CHANGE_REQUIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  test('lets the change-password endpoint through while pending', async () => {
    const { next } = await run(authenticateAllowPasswordChange, true);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('normal users are unaffected', async () => {
    const { next } = await run(authenticate, false);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
