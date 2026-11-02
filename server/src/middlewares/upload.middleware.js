const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createUploadValidator } = require('../utils/uploadValidation');

const uploadsDir = path.join(__dirname, '../../public/uploads/tickets');

const allowedTypes = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.txt': ['text/plain']
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

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedTypes[ext] || !allowedTypes[ext].includes(file.mimetype)) {
      return cb(new Error('Unsupported attachment type'));
    }
    cb(null, true);
  }
});

upload.validateContent = createUploadValidator(allowedTypes, 'Invalid attachment content');

module.exports = upload;
