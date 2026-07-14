const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
// Forgot password OTP endpoints
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', authController.resetPassword);

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.post('/switch-role', authenticate, authController.switchRole);
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
