const { verifyAccessToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const userModel = require('../models/user.model');

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendError(res, 'Authorization token is missing', 401);
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    const user = await userModel.findUserById(decoded.userId);
    if (
      !user ||
      String(user.status || '').toLowerCase() !== 'active' ||
      (Number(decoded.tokenVersion) || 0) !== (Number(user.token_version) || 0)
    ) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ AUTH ERROR:', error.message);
    return sendError(res, 'Authentication failed', 401);
  }
};
