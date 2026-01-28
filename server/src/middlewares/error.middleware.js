const { sendError } = require('../utils/response');

exports.errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return sendError(res, message, statusCode);
};

exports.notFoundHandler = (req, res) => {
  return sendError(res, 'Route not found', 404);
};
