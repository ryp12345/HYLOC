const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createUploadValidator, createSafeSingleUpload, uploadRejection } = require('../utils/uploadValidation');

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
  // One file per request, 10 MB, and bounded form fields
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 30, fieldSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedTypes[ext] || !allowedTypes[ext].includes(file.mimetype)) {
      return cb(uploadRejection('Unsupported attachment type. Allowed: PDF, PNG, JPG, XLSX, DOCX, TXT.'));
    }
    cb(null, true);
  }
});

upload.validateContent = createUploadValidator(allowedTypes, 'Invalid attachment content');
// Use instead of upload.single(): returns 400/413 for upload errors instead of 500
upload.safeSingle = createSafeSingleUpload(upload, '10 MB');

module.exports = upload;
