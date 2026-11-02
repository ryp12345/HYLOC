const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response');

const LOGIN_LIMIT_MESSAGE = 'Too many login attempts in a short period. Please wait 1 minute and try again.';
const RESET_LIMIT_MESSAGE = 'Too many password reset requests in a short period. Please wait 1 minute and try again.';

const createAuthLimiter = (windowMs, limit, message, keyGenerator) => rateLimit({
  windowMs,
  limit,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => sendError(res, message, 429, { code: 'RATE_LIMITED' })
});

exports.loginIpLimiter = createAuthLimiter(60 * 1000, 5, LOGIN_LIMIT_MESSAGE);
exports.loginAccountLimiter = createAuthLimiter(
  60 * 1000,
  5,
  LOGIN_LIMIT_MESSAGE,
  (req) => crypto.createHash('sha256')
    .update(String(req.body?.empid || '').trim().toLowerCase())
    .digest('hex')
);
exports.passwordResetLimiter = createAuthLimiter(60 * 1000, 5, RESET_LIMIT_MESSAGE);
