const { errorHandler } = require('./error.middleware');

describe('errorHandler', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns a generic server message while logging the error details', () => {
    const error = new Error('Database connection string contains private details');
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
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

    errorHandler(error, {}, response, jest.fn());

    expect(response.statusCode).toBe(500);
    expect(response.body.message).toBe('Internal server error');
    expect(response.body.message).not.toContain('private details');
    expect(consoleError).toHaveBeenCalledWith('Unhandled request error:', error);
  });
});
