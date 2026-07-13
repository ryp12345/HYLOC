const userModel = require('../models/user.model');
const { hashPassword } = require('../utils/hash');
const { sendSuccess, sendError } = require('../utils/response');
const fs = require('fs');
const path = require('path');

const STAFF_PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const UPLOADS_USERS_DIR = path.join(__dirname, '../../public/uploads/users');

const deletePhotoVariants = (photoPath) => {
  if (!photoPath) return;

  const normalized = String(photoPath).replace(/^https?:\/\/[^/]+/i, '');
  const relative = normalized.startsWith('/api/uploads/users/')
    ? normalized.replace('/api/uploads/users/', '')
    : normalized.startsWith('/uploads/users/')
      ? normalized.replace('/uploads/users/', '')
      : normalized.replace(/^\/+/, '');

  const baseName = path.parse(relative).name || relative;
  const extension = path.parse(relative).ext;

  const candidates = new Set();
  if (relative) candidates.add(relative);
  if (baseName && extension) candidates.add(`${baseName}${extension}`);
  STAFF_PHOTO_EXTENSIONS.forEach((ext) => candidates.add(`${baseName}.${ext}`));

  candidates.forEach((candidate) => {
    const filePath = path.join(UPLOADS_USERS_DIR, candidate);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Failed to remove old staff photo:', error.message);
      }
    }
  });
};

const buildStaffPhotoCandidates = (user) => {
  const candidates = [];
  const appOrigin = process.env.APP_URL || '';
  const baseUrl = appOrigin ? appOrigin.replace(/\/$/, '') : '';
  const toAbsoluteUrl = (value) => {
    if (baseUrl) return `${baseUrl}${value}`;
    return value;
  };

  const findExistingUpload = (fileName) => {
    if (!fileName) return '';
    const normalized = String(fileName).replace(/^\/+/, '');
    const directPath = path.join(UPLOADS_USERS_DIR, normalized);
    if (fs.existsSync(directPath)) {
      return `/api/uploads/users/${normalized}`;
    }

    const baseName = path.parse(normalized).name || normalized;
    const extension = path.parse(normalized).ext;

    if (extension) {
      const normalizedWithExt = path.join(UPLOADS_USERS_DIR, `${baseName}${extension}`);
      if (fs.existsSync(normalizedWithExt)) {
        return `/api/uploads/users/${baseName}${extension}`;
      }
    }

    const matchedFile = STAFF_PHOTO_EXTENSIONS
      .map((ext) => `${baseName}.${ext}`)
      .find((candidate) => fs.existsSync(path.join(UPLOADS_USERS_DIR, candidate)));

    return matchedFile ? `/api/uploads/users/${matchedFile}` : '';
  };

  const addCandidate = (value) => {
    if (!value) return;
    if (/^https?:\/\//i.test(value)) {
      candidates.push(value);
      return;
    }
    if (value.startsWith('/api/uploads/') || value.startsWith('/uploads/')) {
      candidates.push(toAbsoluteUrl(value));
      return;
    }
    const existingUpload = findExistingUpload(value);
    candidates.push(existingUpload ? toAbsoluteUrl(existingUpload) : toAbsoluteUrl(`/api/uploads/users/${String(value).replace(/^\/+/, '')}`));
  };

  addCandidate(user?.staff_photo);

  const empid = String(user?.empid || '').trim();
  if (empid) {
    addCandidate(empid);
    STAFF_PHOTO_EXTENSIONS.forEach((ext) => addCandidate(`${empid}.${ext}`));
  }

  return [...new Set(candidates)];
};

const attachStaffPhotoUrl = (user) => {
  if (!user) return user;
  const photoCandidates = buildStaffPhotoCandidates(user);
  return {
    ...user,
    staff_photo_url: photoCandidates[0] || '',
    staff_photo_candidates: photoCandidates,
  };
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    return sendSuccess(res, users, 'Users retrieved successfully');
  } catch (error) {
    console.error('Get all users error:', error);
    return sendError(res, 'Failed to retrieve users', 500);
  }
};

// Get users by department (manager-safe)
exports.getUsersByDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const users = await userModel.getUsersByDepartment(id);
    return sendSuccess(res, users, 'Department users retrieved successfully');
  } catch (error) {
    console.error('Get users by department error:', error);
    return sendError(res, 'Failed to retrieve department users', 500);
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findUserById(id);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }
    
    return sendSuccess(res, attachStaffPhotoUrl(user), 'User retrieved successfully');
  } catch (error) {
    console.error('Get user by ID error:', error);
    return sendError(res, 'Failed to retrieve user', 500);
  }
};

// Create new user
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, middleName, lastName, empid, phone, address, bloodGroup, departmentId, designationId, role = 'employee', status = 'active' } = req.body;

    // Build staff photo URL from uploaded file if present
    const staffPhoto = req.file ? `/api/uploads/users/${req.file.filename}` : (req.body.staffPhoto || null);

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return sendError(res, 'Email, password, first name, and last name are required', 400);
    }

    // Check if user already exists
    const existingUser = await userModel.findUserByEmail(email);
    if (existingUser) {
      return sendError(res, 'User with this email already exists', 400);
    }

    // Check if empid already exists
    if (empid) {
      const existingEmpid = await userModel.findUserByEmpid(empid);
      if (existingEmpid) {
        return sendError(res, 'User with this employee ID already exists', 400);
      }
    }

    // Create user
    const newUser = await userModel.createUser({ 
      email, 
      password, 
      firstName, 
      middleName,
      lastName, 
      empid,
      phone,
      address,
      bloodGroup,
      departmentId,
      designationId,
      staffPhoto,
      role,
      status
    });

    ////////////////Send greeting notification to new user////////////////////////////////
    try {
      const notificationModel = require('../models/notification.model');
      await notificationModel.createNotification({
        created_by: newUser.id, // or system/admin id if available
        assigned_to: newUser.id,
        message: `Welcome ${firstName} ${lastName}! Your account has been created.`,
        type: 'greeting',
        is_read: false
      });
    } catch (notifyErr) {
      console.error('Greeting notification error:', notifyErr);
      // Do not block user creation on notification failure
    }
    ////////////////Notification Code to send greeting for new user///////////////////////
    
    return sendSuccess(res, newUser, 'User created successfully', 201);
  } catch (error) {
    console.error('Create user error:', error);
    return sendError(res, 'Failed to create user', 500);
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Check if user exists
    const existingUser = await userModel.findUserById(id);
    if (!existingUser) {
      return sendError(res, 'User not found', 404);
    }

    // Map camelCase to snake_case for database
    if (req.body.firstName !== undefined) updates.firstname = req.body.firstName;
    if (req.body.middleName !== undefined) updates.middlename = req.body.middleName;
    if (req.body.lastName !== undefined) updates.lastname = req.body.lastName;
    if (req.body.empid !== undefined) updates.empid = req.body.empid;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.address !== undefined) updates.address = req.body.address;
    if (req.body.bloodGroup !== undefined) updates.bloodgroup = req.body.bloodGroup;
    if (req.body.departmentId !== undefined) updates.department_id = req.body.departmentId;
    if (req.body.designationId !== undefined) updates.designation_id = req.body.designationId;
    if (req.file) {
      updates.staff_photo = `/api/uploads/users/${req.file.filename}`;
    } else if (req.body.staffPhoto !== undefined) {
      updates.staff_photo = req.body.staffPhoto;
    }
    if (req.body.email !== undefined) {
      // Check if email is already taken by another user
      const emailExists = await userModel.findUserByEmail(req.body.email);
      if (emailExists && emailExists.id !== parseInt(id)) {
        return sendError(res, 'Email already taken by another user', 400);
      }
      updates.email = req.body.email;
    }
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (req.body.status !== undefined) updates.status = req.body.status;
    
    // Hash password if provided
    if (req.body.password) {
      updates.password = await hashPassword(req.body.password);
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'No fields to update', 400);
    }

    const updatedUser = await userModel.updateUser(id, updates);

    if (req.file && existingUser?.staff_photo && existingUser.staff_photo !== updates.staff_photo) {
      deletePhotoVariants(existingUser.staff_photo);
    }
    
    return sendSuccess(res, updatedUser, 'User updated successfully');
  } catch (error) {
    console.error('Update user error:', error);
    return sendError(res, 'Failed to update user', 500);
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await userModel.findUserById(id);
    if (!existingUser) {
      return sendError(res, 'User not found', 404);
    }

    // Prevent deleting yourself
    if (req.user.userId === parseInt(id)) {
      return sendError(res, 'You cannot delete your own account', 400);
    }

    await userModel.deleteUser(id);
    
    return sendSuccess(res, null, 'User deleted successfully');
  } catch (error) {
    console.error('Delete user error:', error);
    return sendError(res, 'Failed to delete user', 500);
  }
};

// Get current user profile
exports.getMyProfile = async (req, res) => {
  try {
    const user = await userModel.findUserById(req.user.userId);
    return sendSuccess(res, attachStaffPhotoUrl(user), 'Profile retrieved successfully');
  } catch (error) {
    console.error('Get profile error:', error);
    return sendError(res, 'Failed to retrieve profile', 500);
  }
};

// Update current user profile (self-update)
exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, middleName, lastName, email, phone, address, bloodGroup, departmentId, designationId } = req.body;
    const existingUser = await userModel.findUserById(userId);

    if (!existingUser) {
      return sendError(res, 'User not found', 404);
    }

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return sendError(res, 'First name, last name, and email are required', 400);
    }

    // Check if email is being changed and if it's already taken by another user
    if (email) {
      const existingUser = await userModel.findUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return sendError(res, 'Email already exists', 400);
      }
    }

    // Update user with allowed fields only (convert to snake_case for database)
    const updateData = {
      firstname: firstName,
      middlename: middleName || null,
      lastname: lastName,
      email,
      phone: phone || null,
      address: address || null,
      bloodgroup: bloodGroup || null,
      department_id: departmentId || null,
      designation_id: designationId || null
    };

    // Store uploaded staff photo if provided
    if (req.file) {
      updateData.staff_photo = `/api/uploads/users/${req.file.filename}`;
    } else if (req.body.staffPhoto !== undefined) {
      updateData.staff_photo = req.body.staffPhoto;
    }

    const updatedUser = await userModel.updateUser(userId, updateData);

    if (req.file && existingUser?.staff_photo && existingUser.staff_photo !== updateData.staff_photo) {
      deletePhotoVariants(existingUser.staff_photo);
    }
    
    return sendSuccess(res, updatedUser, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    return sendError(res, 'Failed to update profile', 500);
  }
};

// Get minimal list of assignable users (safe for non-admins)
exports.getAssignableUsers = async (req, res) => {
  try {
    const users = await userModel.getAssignableUsers();
    return sendSuccess(res, users, 'Assignable users retrieved successfully');
  } catch (error) {
    console.error('Get assignable users error:', error);
    return sendError(res, 'Failed to retrieve assignable users', 500);
  }
};



