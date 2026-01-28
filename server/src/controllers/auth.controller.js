const authService = require('../services/auth.service');
const { validateLogin, validateRegister } = require('../validations/auth.validation');
const { sendSuccess, sendError } = require('../utils/response');

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
    
    return sendSuccess(res, {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    }, 'Profile retrieved successfully', 200);
  } catch (error) {
    console.error('Get profile error:', error.message);
    return sendError(res, error.message || 'Failed to get profile', 400);
  }
};
