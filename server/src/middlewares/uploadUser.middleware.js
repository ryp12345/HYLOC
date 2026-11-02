const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createUploadValidator } = require('../utils/uploadValidation');

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedTypes[ext] || !allowedTypes[ext].includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WEBP photos are allowed'));
    }
    cb(null, true);
  }
});

uploadUser.validateContent = createUploadValidator(allowedTypes, 'Invalid photo content');

module.exports = uploadUser;
