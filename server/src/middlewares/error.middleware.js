const { sendError } = require('../utils/response');

exports.errorHandler = (err, req, res, next) => {
  console.error('Unhandled request error:', err);

  const statusCode = err.statusCode || 500;
  const message = statusCode >= 500 ? 'Internal server error' : 'Request failed';

  return sendError(res, message, statusCode);
};

exports.notFoundHandler = (req, res) => {
  return sendError(res, 'Route not found', 404);
};
