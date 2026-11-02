const fs = require('fs');
const os = require('os');
const path = require('path');
const { createUploadValidator } = require('./uploadValidation');

describe('upload content validation', () => {
  let directory;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hyloc-upload-validation-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const createResponse = () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    return { response: { status }, status, json };
  };

  test('accepts content matching the upload extension and MIME type', () => {
    const filePath = path.join(directory, 'valid.png');
    fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const req = { file: { path: filePath, originalname: 'photo.png', mimetype: 'image/png' } };
    const next = jest.fn();
    const { response } = createResponse();

    createUploadValidator({ '.png': ['image/png'] }, 'Invalid photo content')(req, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('rejects and removes content that does not match its extension', () => {
    const filePath = path.join(directory, 'invalid.png');
    fs.writeFileSync(filePath, '<html>not an image</html>');
    const req = { file: { path: filePath, originalname: 'photo.png', mimetype: 'image/png' } };
    const next = jest.fn();
    const { response, status, json } = createResponse();

    createUploadValidator({ '.png': ['image/png'] }, 'Invalid photo content')(req, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid photo content',
      errors: null
    });
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('rejects a MIME type that is not allowed for the extension', () => {
    const filePath = path.join(directory, 'mismatched.png');
    fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const req = { file: { path: filePath, originalname: 'photo.png', mimetype: 'text/html' } };
    const next = jest.fn();
    const { response, status } = createResponse();

    createUploadValidator({ '.png': ['image/png'] }, 'Invalid photo content')(req, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
