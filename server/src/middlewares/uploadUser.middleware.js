const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createUploadValidator, createSafeSingleUpload, uploadRejection } = require('../utils/uploadValidation');

const uploadsDir = path.join(__dirname, '../../public/uploads/users');

const allowedTypes = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp']
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (err) {
      return cb(err);
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  }
});

const uploadUser = multer({
  storage,
  // One photo per request, 5 MB, and bounded form fields
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30, fieldSize: 64 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedTypes[ext] || !allowedTypes[ext].includes(file.mimetype)) {
      return cb(uploadRejection('Only JPEG, PNG, and WEBP photos are allowed'));
    }
    cb(null, true);
  }
});

uploadUser.validateContent = createUploadValidator(allowedTypes, 'Invalid photo content');
// Use instead of uploadUser.single(): returns 400/413 for upload errors instead of 500
uploadUser.safeSingle = createSafeSingleUpload(uploadUser, '5 MB');

module.exports = uploadUser;
