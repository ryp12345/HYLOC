const { verifyAccessToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');
const userModel = require('../models/user.model');

const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

// The flag is read from the database on every request (not from the token),
// so tokens issued before a reset or before the change cannot get around it.
const createAuthenticate = ({ allowPendingPasswordChange }) => async (req, res, next) => {
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

    if (user.must_change_password === true && !allowPendingPasswordChange) {
      return sendError(
        res,
        'You must change your temporary password before continuing.',
        403,
        { code: PASSWORD_CHANGE_REQUIRED }
      );
    }

    req.user = decoded;
    req.user.mustChangePassword = user.must_change_password === true;
    next();
  } catch (error) {
    console.error('❌ AUTH ERROR:', error.message);
    return sendError(res, 'Authentication failed', 401);
  }
};

// Every protected route. Blocked while the user still has a temporary password.
exports.authenticate = createAuthenticate({ allowPendingPasswordChange: false });

// Only for the few endpoints needed to finish the forced change (change-password, profile).
exports.authenticateAllowPasswordChange = createAuthenticate({ allowPendingPasswordChange: true });

exports.PASSWORD_CHANGE_REQUIRED = PASSWORD_CHANGE_REQUIRED;
