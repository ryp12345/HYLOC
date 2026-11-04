const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { sendError } = require('./response');

// ---------------------------------------------------------------------------
// Content checks. The extension and MIME type come from the client, so the
// file's bytes must also match the claimed type.
// ---------------------------------------------------------------------------

const readHeader = (filePath, length) => {
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, 'r');
  let bytesRead;
  try {
    bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.subarray(0, bytesRead);
};

// PDF features that can run code or open other programs when the file is viewed
const PDF_ACTIVE_CONTENT = /\/(JavaScript|JS|Launch|RichMedia|EmbeddedFile)(?![A-Za-z0-9])/;

// Each Office type must contain its own main part; macro projects are refused.
const OFFICE_REQUIRED_PART = {
  '.docx': 'word/',
  '.xlsx': 'xl/'
};

const isZipHeader = (header) => header.length >= 4 &&
  header[0] === 0x50 && header[1] === 0x4b &&
  [0x03, 0x05, 0x07].includes(header[2]) && [0x04, 0x06, 0x08].includes(header[3]);

const hasExpectedContent = (filePath, extension) => {
  const header = readHeader(filePath, 12);

  switch (extension) {
    case '.pdf': {
      if (header.subarray(0, 5).toString() !== '%PDF-') return false;
      // Upload size is capped by multer, so reading the whole file is bounded
      const content = fs.readFileSync(filePath).toString('latin1');
      return !PDF_ACTIVE_CONTENT.test(content);
    }
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
    case '.docx': {
      if (!isZipHeader(header)) return false;
      // ZIP entry names are stored as plain text, so they can be checked without unpacking
      const content = fs.readFileSync(filePath).toString('latin1');
      return content.includes('[Content_Types].xml') &&
        content.includes(OFFICE_REQUIRED_PART[extension]) &&
        !/vbaProject\.bin/i.test(content);
    }
    case '.txt': {
      // Plain text only: no binary content anywhere in the file
      const content = fs.readFileSync(filePath);
      return !content.includes(0);
    }
    default:
      return false;
  }
};

const removeFile = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, (error) => {
    if (error && error.code !== 'ENOENT') {
      console.error('Failed to remove uploaded file:', error.message);
    }
  });
};

const createUploadValidator = (allowedTypes, errorMessage) => (req, res, next) => {
  if (!req.file) return next();
  const extension = path.extname(req.file.originalname || '').toLowerCase();
  const mimeTypes = allowedTypes[extension];
  let valid = false;
  try {
    valid = Boolean(mimeTypes && mimeTypes.includes(req.file.mimetype) && hasExpectedContent(req.file.path, extension));
  } catch (error) {
    console.error('Upload content check failed:', error.message);
    valid = false;
  }

  if (valid) {
    // Don't keep files from requests that end up failing (validation errors,
    // permission errors, server errors); they would only fill the disk.
    if (typeof res.on === 'function') {
      const uploadedPath = req.file.path;
      res.on('finish', () => {
        if (res.statusCode >= 400) removeFile(uploadedPath);
      });
    }
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

// ---------------------------------------------------------------------------
// Wrapper around multer.single(): turns upload errors into clear 4xx answers
// instead of a generic 500 from the global error handler.
// ---------------------------------------------------------------------------
const createSafeSingleUpload = (uploader, maxSizeLabel) => (fieldName) => (req, res, next) => {
  uploader.single(fieldName)(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path) removeFile(req.file.path);
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, `File is too large. The maximum size is ${maxSizeLabel}.`, 413);
      }
      return sendError(res, 'Only one file can be uploaded, in the expected field.', 400);
    }
    // Errors raised by our own fileFilter (type not on the allowlist)
    if (error.isUploadRejection) {
      return sendError(res, error.message, 400);
    }
    // Anything else (e.g. disk errors): generic 500, details only in the server log
    return next(error);
  });
};

// Error for the multer fileFilter when a file type is not on the allowlist
const uploadRejection = (message) => Object.assign(new Error(message), { isUploadRejection: true });

// Headers for serving user-uploaded files: never sniff the type, and if a
// browser does render the file, run it in a sandbox with no scripts or network.
const setUntrustedFileHeaders = (res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
};

module.exports = {
  createUploadValidator,
  createSafeSingleUpload,
  setUntrustedFileHeaders,
  hasExpectedContent,
  uploadRejection
};
