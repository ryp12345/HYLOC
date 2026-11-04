const authService = require('../services/auth.service');
const { validateLogin } = require('../validations/auth.validation');
const { sendSuccess, sendError } = require('../utils/response');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model');
const passwordResetModel = require('../models/passwordReset.model');
const loginAttemptModel = require('../models/loginAttempt.model');
const config = require('../config');
const { getPasswordError } = require('../utils/passwordPolicy');
const { escapeHtml } = require('../utils/escapeHtml');

const verifyResetOtp = async (userId, otp) => {
  const request = await passwordResetModel.findActiveRequest(userId);
  if (!request) return null;
  if (await bcrypt.compare(String(otp), request.otp_hash)) return request;
  await passwordResetModel.recordFailedAttempt(request.id);
  return null;
};

exports.login = async (req, res) => {
  try {
    const { empid, password } = req.body;

    // Validate input
    const validation = validateLogin(empid, password);
    if (!validation.isValid) {
      return sendError(res, 'Validation error', 400, validation.errors);
    }

    // Login user
    const result = await authService.login(empid, password);
    
    return sendSuccess(res, result, 'Login successful', 200);
  } catch (error) {
    if (error.code === 'ACCOUNT_LOCKED') {
      const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
      res.set('Retry-After', String(error.retryAfterSeconds));
      return sendError(
        res,
        `Your account has been temporarily locked due to multiple unsuccessful login attempts. ` +
        `Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or use "Forgot Password" to reset your password.`,
        423,
        { code: 'ACCOUNT_LOCKED', retryAfterSeconds: error.retryAfterSeconds }
      );
    }
    if (error.code === 'ACCOUNT_INACTIVE') {
      return sendError(
        res,
        'Your account is currently inactive. Please contact your HR department or system administrator to have it reactivated.',
        403,
        { code: 'ACCOUNT_INACTIVE' }
      );
    }
    console.error('Login error:', error);
    return sendError(res, 'Invalid employee ID or password', 401);
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken, selectedRole } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 400);
    }

    const result = await authService.refreshAccessToken(refreshToken, selectedRole);
    
    return sendSuccess(res, result, 'Token refreshed successfully', 200);
  } catch (error) {
    console.error('Refresh token error:', error);
    return sendError(res, 'Invalid or expired refresh token', 401);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await authService.getUserById(userId);
    
    const activeRoles = await authService.getActiveRoles(userId);
    const selectedRole = activeRoles.find(
      (role) => String(role).toLowerCase() === String(req.user.role || '').toLowerCase()
    );
    const userRole = selectedRole || activeRoles[0] || req.user.role || 'Employee';
    
    return sendSuccess(res, {
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      role: userRole,
      mustChangePassword: user.must_change_password === true
    }, 'Profile retrieved successfully', 200);
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 'Failed to retrieve profile', 500);
  }
};

exports.switchRole = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { role } = req.body;

    if (!role) {
      return sendError(res, 'Role is required', 400);
    }

    const result = await authService.switchRole(userId, role);
    return sendSuccess(res, result, 'Role switched successfully', 200);
  } catch (error) {
    console.error('Switch role error:', error);
    if (error.message === 'You do not have access to this role') {
      return sendError(res, error.message, 403);
    }
    return sendError(res, 'Failed to switch role', 500);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return sendError(res, 'Current password, new password and confirmation are required', 400);
    }
    if (newPassword !== confirmPassword) {
      return sendError(res, 'New password and confirmation do not match', 400);
    }
    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      return sendError(res, passwordError, 400);
    }

    // Returns a fresh session: the change ends all earlier sessions, including this one
    const session = await authService.changePassword(userId, String(currentPassword), newPassword, req.user.role);
    res.set('Cache-Control', 'no-store');
    return sendSuccess(res, session, 'Password changed successfully', 200);
  } catch (error) {
    console.error('Change password error:', error.message);
    if (
      error.message === 'Current password is incorrect' ||
      error.message === 'New password must be different from the current password'
    ) {
      return sendError(res, error.message, 400);
    }
    return sendError(res, 'Failed to change password', 500);
  }
};

// --- Forgot Password (OTP) Flow ---
// Step 1: Request OTP
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendSuccess(res, {}, 'OTP sent to your email for password reset.', 200);
    const user = await UserModel.findUserByEmail(email);
    if (!user) return sendSuccess(res, {}, 'OTP sent to your email for password reset.', 200);

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    await passwordResetModel.createRequest(user.id, otpHash);

    // Send OTP via email (use server config if available)
    const smtp = config.smtp || {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASS
    };

    // Send to the address on record (not the raw request value), and HTML-encode
    // it wherever it appears in the HTML version of the email.
    const recipient = user.email;
    const safeRecipient = escapeHtml(recipient);

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.password ? { user: smtp.user, pass: smtp.password } : undefined,
    });
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Hyloc Support" <no-reply@hyloc.co.in>',
      to: recipient,
      subject: 'Password Reset Request',
      text: `Hello,\n\nWe received a request to reset the password for the Hyloc account associated with ${recipient}. Please use the verification code below to continue. This code is valid for 5 minutes.\n\n${otp}\n\nTo complete your password reset, open the Hyloc password reset page and enter the 6-digit verification code shown above.\n\nIf you did not request a password reset, you may safely ignore this email..\n\nFor security reasons, do not share this code with anyone. This code will expire after 5 minutes.\n\nRegards,\n\nHyloc Support Team`,
      html: `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>Password Reset Request</title>
          </head>
          <body style="font-family: Arial, Helvetica, sans-serif; background:#f7f7f9; margin:0; padding:20px;">
            <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e6ef;padding:24px;color:#111;">
              <h2 style="font-size:18px;margin:0 0 12px;">Password Reset Request</h2>
              <p style="margin:0 0 12px;">Hello,</p>
              <p style="margin:0 0 16px;">We received a request to reset the password for the Hyloc account associated with <strong>${safeRecipient}</strong>. Please use the verification code below to continue. This code is valid for <strong>5 minutes</strong>.</p>
              <div style="text-align:center;margin:18px 0;">
                <div style="display:inline-block;padding:16px 22px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;">
                  <span style="font-size:28px;letter-spacing:4px;font-weight:700;color:#111;">${otp}</span>
                </div>
              </div>
              <p style="margin:0 0 16px;">To complete your password reset, open the Hyloc password reset page and enter the 6-digit verification code shown above.</p>
              <p style="margin:0 0 12px;">If you did not request a password reset, you may safely ignore this email.</p>
              <p style="font-size:12px;color:#6b7280;margin:12px 0 0;">For security reasons,please do not share this code with anyone. This code will expire after 5 minutes.</p>
              <p style="margin:18px 0 0;">Regards,<br/><br/>Hyloc Support Team</p>
            </div>
          </body>
        </html>`
    };
    try {
      await transporter.sendMail(mailOptions);
    } catch (mailErr) {
      console.error('Error sending OTP email:', mailErr);
      return sendSuccess(res, {}, 'OTP sent to your email for password reset.', 200);
    }

    return sendSuccess(res, {}, 'OTP sent to your email for password reset.', 200);
  } catch (error) {
    console.error('Request password reset error:', error);
    // Always return success to prevent email enumeration
    return sendSuccess(res, {}, 'OTP sent to your email for password reset.', 200);
  }
};

// Step 2: Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !/^\d{6}$/.test(String(otp || ''))) return sendError(res, 'Invalid OTP or expired', 400);
    const user = await UserModel.findUserByEmail(email);
    if (!user) return sendError(res, 'Invalid OTP or expired', 400);
    const request = await verifyResetOtp(user.id, otp);
    if (!request) return sendError(res, 'Invalid OTP or expired', 400);
    return sendSuccess(res, {}, 'OTP verified', 200);
  } catch (error) {
    console.error('OTP verification error:', error);
    return sendError(res, 'Invalid OTP or expired', 400);
  }
};

// Step 3: Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !/^\d{6}$/.test(String(otp || '')) || !newPassword) {
      return sendError(res, 'Invalid OTP or expired', 400);
    }
    const passwordError = getPasswordError(newPassword);
    if (passwordError) return sendError(res, passwordError, 400);
    const user = await UserModel.findUserByEmail(email);
    if (!user) return sendError(res, 'Invalid OTP or expired', 400);
    const request = await verifyResetOtp(user.id, otp);
    if (!request) return sendError(res, 'Invalid OTP or expired', 400);
    if (!(await passwordResetModel.consumeRequest(request.id))) {
      return sendError(res, 'Invalid OTP or expired', 400);
    }
    // The user chose this password themselves, so no forced change is needed
    await UserModel.updateUser(user.id, { password: newPassword, must_change_password: false });
    // The user proved they own the account, so lift any login lock
    await loginAttemptModel.clear(user.id);
    return sendSuccess(res, {}, 'Password reset successful', 200);
  } catch (error) {
    console.error('Password reset error:', error);
    return sendError(res, 'Invalid OTP or expired', 400);
  }
};
