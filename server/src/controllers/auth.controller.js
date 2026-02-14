const authService = require('../services/auth.service');
const { validateLogin, validateRegister } = require('../validations/auth.validation');
const { sendSuccess, sendError } = require('../utils/response');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model');
const config = require('../config');

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validate input
    const validation = validateRegister(email, password, firstName, lastName);
    if (!validation.isValid) {
      return sendError(res, 'Validation error', 400, validation.errors);
    }

    // Register user
    const result = await authService.register(email, password, firstName, lastName);
    
    return sendSuccess(res, result, 'User registered successfully', 201);
  } catch (error) {
    console.error('Register error:', error.message);
    return sendError(res, error.message || 'Registration failed', 400);
  }
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
    console.error('Login error:', error.message);
    return sendError(res, error.message || 'Login failed', 401);
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 400);
    }

    const result = await authService.refreshAccessToken(refreshToken);
    
    return sendSuccess(res, result, 'Token refreshed successfully', 200);
  } catch (error) {
    console.error('Refresh token error:', error.message);
    return sendError(res, error.message || 'Token refresh failed', 401);
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await authService.getUserById(userId);
    
    // Determine role based on empid or email
    let userRole = 'employee';
    if (user.empid === 10000 || user.email === 'admin@hyloc.co.in') {
      userRole = 'admin';
    }
    
    return sendSuccess(res, {
      id: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      role: userRole
    }, 'Profile retrieved successfully', 200);
  } catch (error) {
    console.error('Get profile error:', error.message);
    return sendError(res, error.message || 'Failed to get profile', 400);
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 'Both current and new passwords are required', 400);
    }
    if (newPassword.length < 6) {
      return sendError(res, 'New password must be at least 6 characters', 400);
    }

    await authService.changePassword(userId, currentPassword, newPassword);
    return sendSuccess(res, null, 'Password changed successfully', 200);
  } catch (error) {
    console.error('Change password error:', error.message);
    return sendError(res, error.message || 'Failed to change password', 400);
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

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Create JWT reset token (expires in 5 min)
    const resetToken = jwt.sign(
      { email, otp },
      config.jwt.secret + user.password,
      { expiresIn: '5m' }
    );

    // Send OTP via email (use server config if available)
    const smtp = config.smtp || {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASS
    };

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.password ? { user: smtp.user, pass: smtp.password } : undefined,
    });
    const mailOptions = {
      from: process.env.SMTP_FROM || '"Hyloc Support" <no-reply@hyloc.co.in>',
      to: email,
      subject: 'Password Reset Request',
      text: `Hello,\n\nWe received a request to reset the password for the Hyloc account associated with ${email}. Please use the verification code below to continue. This code is valid for 5 minutes.\n\n${otp}\n\nTo complete your password reset, open the Hyloc password reset page and enter the 6-digit verification code shown above.\n\nIf you did not request a password reset, you may safely ignore this email..\n\nFor security reasons, do not share this code with anyone. This code will expire after 5 minutes.\n\nRegards,\n\nHyloc Support Team`,
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
              <p style="margin:0 0 16px;">We received a request to reset the password for the Hyloc account associated with <strong>${email}</strong>. Please use the verification code below to continue. This code is valid for <strong>5 minutes</strong>.</p>
              <div style="text-align:center;margin:18px 0;">
                <div style="display:inline-block;padding:16px 22px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;">
                  <span style="font-size:28px;letter-spacing:4px;font-weight:700;color:#111;">${otp}</span>
                </div>
              </div>
              <p style="margin:0 0 16px;">To complete your password reset, open the Hyloc password reset page and enter the 6-digit verification code shown above.</p>
              <p style="margin:0 0 12px;">If you did not request a password reset, you may safely ignore this email.</p>
              <p style="font-size:12px;color:#6b7280;margin:12px 0 0;">For security reasons, do not share this code with anyone. This code will expire after 5 minutes.</p>
              <p style="margin:18px 0 0;">Regards,<br/><br/>Hyloc Support Team</p>
            </div>
          </body>
        </html>`
    };
    try {
      await transporter.sendMail(mailOptions);
    } catch (mailErr) {
      console.error('Error sending OTP email:', mailErr);
      // Continue and return generic success to the client (prevent enumeration)
      const data = process.env.NODE_ENV === 'development' ? { resetToken, otp } : { resetToken };
      return sendSuccess(res, data, 'OTP sent to your email for password reset.', 200);
    }

    // In dev, return OTP for testing
    const data = process.env.NODE_ENV === 'development' ? { resetToken, otp } : { resetToken };
    return sendSuccess(res, data, 'OTP sent to your email for password reset.', 200);
  } catch (error) {
    console.error('Request password reset error:', error);
    // Always return success to prevent email enumeration
    return sendSuccess(res, {}, 'OTP sent to your email for password reset.', 200);
  }
};

// Step 2: Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, resetToken } = req.body;
    if (!email || !otp || !resetToken) {
      console.warn('verifyOTP: missing fields', { email, otpPresent: !!otp, resetTokenPresent: !!resetToken });
      return sendError(res, 'Invalid request', 400);
    }
    const user = await UserModel.findUserByEmail(email);
    if (!user) return sendError(res, 'Invalid OTP or expired', 400);
    let payload;
    try {
      payload = jwt.verify(resetToken, config.jwt.secret + user.password);
    } catch (err) {
      console.error('verifyOTP: jwt.verify failed', { err: err.message, resetTokenSnippet: resetToken?.slice(0,20), userId: user.id });
      return sendError(res, 'Invalid OTP or expired', 400);
    }
    if (payload.otp !== otp) return sendError(res, 'Invalid OTP or expired', 400);
    return sendSuccess(res, {}, 'OTP verified', 200);
  } catch (error) {
    console.error('verifyOTP: unexpected error', error);
    return sendError(res, 'Invalid OTP or expired', 400);
  }
};

// Step 3: Reset Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, resetToken } = req.body;
    if (!email || !otp || !newPassword || !resetToken) return sendError(res, 'Invalid request', 400);
    if (newPassword.length < 6) return sendError(res, 'Password must be at least 6 characters', 400);
    const user = await UserModel.findUserByEmail(email);
    if (!user) return sendError(res, 'Invalid OTP or expired', 400);
    let payload;
    try {
      payload = jwt.verify(resetToken, config.jwt.secret + user.password);
    } catch (err) {
        console.error('resetPassword: jwt.verify failed', { err: err.message, resetTokenSnippet: resetToken?.slice(0,20), userId: user.id });
        return sendError(res, 'Invalid OTP or expired', 400);
    }
    if (payload.otp !== otp) return sendError(res, 'Invalid OTP or expired', 400);
    // Hash new password and update
    const hashed = await bcrypt.hash(newPassword, 10);
    await UserModel.updateUser(user.id, { password: hashed });
    return sendSuccess(res, {}, 'Password reset successful', 200);
  } catch (error) {
    return sendError(res, 'Invalid OTP or expired', 400);
  }
};



