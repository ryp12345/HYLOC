const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../public/uploads/tickets');

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
    const rawName = path.basename(file.originalname || 'attachment');
    const ext = sanitizeExt(path.extname(rawName) || '');
    const base = sanitizeBaseName(path.basename(rawName, path.extname(rawName))) || 'attachment';

    let candidate = `${base}${ext}`;
    let counter = 1;

    while (fs.existsSync(path.join(uploadsDir, candidate))) {
      candidate = `${base}(${counter})${ext}`;
      counter += 1;
    }

    cb(null, candidate);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

module.exports = upload;
