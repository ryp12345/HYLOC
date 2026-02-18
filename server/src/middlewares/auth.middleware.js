const { verifyAccessToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');

exports.authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendError(res, 'Authorization token is missing', 401);
    }

    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    //console.log('✅ AUTH: Decoded token:', { userId: decoded.userId, email: decoded.email, role: decoded.role });
    req.user = decoded;
    next();
  } catch (error) {
    console.error('❌ AUTH ERROR:', error.message);
    return sendError(res, 'Authentication failed', 401);
  }
};
