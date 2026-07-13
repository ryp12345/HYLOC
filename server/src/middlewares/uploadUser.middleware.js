const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../public/uploads/users');

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const sanitizeBaseName = (name) => {
  return String(name || '')
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const sanitizeExt = (ext) => {
  if (!ext) return '';
  return ext.replace(/[^a-zA-Z0-9.]/g, '');
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
    const rawName = path.basename(file.originalname || 'photo');
    const ext = sanitizeExt(path.extname(rawName) || '');

    // Use employee ID as the base name when available, else fall back to original name
    const empid = String(req.body?.empid || '').trim();
    const base = empid ? sanitizeBaseName(empid) : (sanitizeBaseName(path.basename(rawName, path.extname(rawName))) || 'photo');
    cb(null, `${base}${ext}`);
  }
});

const uploadUser = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'));
    }
    cb(null, true);
  }
});

module.exports = uploadUser;
