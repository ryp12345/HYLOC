const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const {
  loginIpLimiter,
  loginAccountLimiter,
  passwordResetLimiter
} = require('../middlewares/authRateLimit.middleware');

const router = express.Router();

// Public routes
router.post('/login', loginIpLimiter, loginAccountLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
// Forgot password OTP endpoints
router.post('/request-password-reset', passwordResetLimiter, authController.requestPasswordReset);
router.post('/verify-otp', passwordResetLimiter, authController.verifyOTP);
router.post('/reset-password', passwordResetLimiter, authController.resetPassword);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.post('/switch-role', authenticate, authController.switchRole);
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
