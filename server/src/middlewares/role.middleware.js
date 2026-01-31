const { sendError } = require('../utils/response');

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }

    // Case-insensitive role comparison
    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      return sendError(res, 'Access denied. Insufficient permissions', 403);
    }

    next();
  };
};
