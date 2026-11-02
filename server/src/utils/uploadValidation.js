const fs = require('fs');
const path = require('path');
const { sendError } = require('./response');

const hasExpectedSignature = (filePath, extension) => {
  const buffer = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  let bytesRead;
  try {
    bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const header = buffer.subarray(0, bytesRead);
  switch (extension) {
    case '.pdf':
      return header.subarray(0, 5).toString() === '%PDF-';
    case '.jpg':
    case '.jpeg':
      return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case '.png':
      return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case '.webp':
      return header.length >= 12 &&
        header.subarray(0, 4).toString() === 'RIFF' &&
        header.subarray(8, 12).toString() === 'WEBP';
    case '.xlsx':
    case '.docx':
      return header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b &&
        [0x03, 0x05, 0x07].includes(header[2]) && [0x04, 0x06, 0x08].includes(header[3]);
    case '.txt':
      return !header.includes(0);
    default:
      return false;
  }
};

const createUploadValidator = (allowedTypes, errorMessage) => (req, res, next) => {
  if (!req.file) return next();

  const extension = path.extname(req.file.originalname || '').toLowerCase();
  const mimeTypes = allowedTypes[extension];
  if (mimeTypes && mimeTypes.includes(req.file.mimetype) && hasExpectedSignature(req.file.path, extension)) {
    return next();
  }

  try {
    fs.unlinkSync(req.file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to remove invalid uploaded file:', error.message);
    }
  }
  return sendError(res, errorMessage, 400);
};

module.exports = { createUploadValidator };
