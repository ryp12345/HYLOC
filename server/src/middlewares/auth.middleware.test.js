jest.mock('../utils/jwt', () => ({
  verifyAccessToken: jest.fn()
}));
jest.mock('../models/user.model', () => ({
  findUserById: jest.fn()
}));

const { verifyAccessToken } = require('../utils/jwt');
const userModel = require('../models/user.model');
const { authenticate } = require('./auth.middleware');

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
