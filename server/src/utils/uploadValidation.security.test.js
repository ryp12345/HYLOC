// Security tests for uploads: content checks, cleanup, error handling, serving headers.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const multer = require('multer');
const {
  createUploadValidator, hasExpectedContent, createSafeSingleUpload, setUntrustedFileHeaders, uploadRejection
} = require('./uploadValidation');

let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hyloc-upload-security-'));
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

const write = (name, content) => {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, content);
  return filePath;
};
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const zipWith = (...entries) => Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(entries.join('\0'), 'latin1')
]);

describe('file content must match its type', () => {
  test.each([
    ['clean PDF', '.pdf', '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj', true],
    ['PDF with JavaScript', '.pdf', '%PDF-1.7\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>', false],
    ['PDF with /JS only', '.pdf', '%PDF-1.7\n<< /S /JS (x) >>', false],
    ['PDF that launches a program', '.pdf', '%PDF-1.7\n<< /S /Launch /F (cmd.exe) >>', false],
    ['PDF with an embedded file', '.pdf', '%PDF-1.7\n<< /Type /EmbeddedFile >>', false],
    ['HTML pretending to be a PDF', '.pdf', '<html><script>alert(1)</script></html>', false],
    ['Windows program renamed .png', '.png', Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]), false],
    ['SVG with script renamed .jpg', '.jpg', '<svg onload="alert(1)"></svg>', false],
    ['text with binary content after the start', '.txt', Buffer.concat([Buffer.from('hello world, normal start'), Buffer.from([0, 1, 2])]), false],
    ['plain text', '.txt', 'Line one\nLine two', true],
    ['real-looking DOCX', '.docx', zipWith('[Content_Types].xml', 'word/document.xml'), true],
    ['real-looking XLSX', '.xlsx', zipWith('[Content_Types].xml', 'xl/workbook.xml'), true],
    ['DOCX with a macro project', '.docx', zipWith('[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin'), false],
    ['any ZIP renamed .docx', '.docx', zipWith('payload.exe'), false],
    ['XLSX renamed .docx', '.docx', zipWith('[Content_Types].xml', 'xl/workbook.xml'), false],
    ['extension not on the allowlist', '.exe', 'MZ', false],
    ['HTML file', '.html', '<script>alert(1)</script>', false]
  ])('%s', (_label, extension, content, expected) => {
    expect(hasExpectedContent(write(`file${extension}`, content), extension)).toBe(expected);
  });
});

describe('uploads from failed requests are removed', () => {
  const fakeResponse = () => {
    const res = new EventEmitter();
    res.statusCode = 200;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; res.emit('finish'); return res; };
    return res;
  };
  const waitForUnlink = () => new Promise((resolve) => setTimeout(resolve, 50));
  const validate = (filePath, res) => createUploadValidator({ '.png': ['image/png'] }, 'bad')(
    { file: { path: filePath, originalname: 'p.png', mimetype: 'image/png' } }, res, () => {}
  );

  test('deleted when the request later fails', async () => {
    const filePath = write('photo.png', PNG);
    const res = fakeResponse();
    validate(filePath, res);
    res.status(400).json({ message: 'Email already exists' });
    await waitForUnlink();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('kept when the request succeeds', async () => {
    const filePath = write('photo.png', PNG);
    const res = fakeResponse();
    validate(filePath, res);
    res.status(201).json({ ok: true });
    await waitForUnlink();
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

describe('upload errors return clear 4xx answers', () => {
  const run = (error) => {
    const uploader = { single: () => (req, res, cb) => cb(error) };
    const res = { statusCode: 200 };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };
    const next = jest.fn();
    createSafeSingleUpload(uploader, '5 MB')('photo')({}, res, next);
    return { res, next };
  };

  test('too large: 413', () => {
    const { res, next } = run(new multer.MulterError('LIMIT_FILE_SIZE'));
    expect(res.statusCode).toBe(413);
    expect(res.body.message).toMatch(/5 MB/);
    expect(next).not.toHaveBeenCalled();
  });

  test('more than one file: 400', () => {
    expect(run(new multer.MulterError('LIMIT_FILE_COUNT')).res.statusCode).toBe(400);
  });

  test('type not on the allowlist: 400 with its message', () => {
    const { res } = run(uploadRejection('Only JPEG, PNG, and WEBP photos are allowed'));
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Only JPEG, PNG, and WEBP photos are allowed');
  });

  test('other errors go to the generic handler, so internal details are not sent', () => {
    const diskError = new Error('EACCES: permission denied, mkdir D:\\secret\\path');
    const { res, next } = run(diskError);
    expect(next).toHaveBeenCalledWith(diskError);
    expect(res.body).toBeUndefined();
  });
});

describe('serving uploaded files', () => {
  test('never sniffed, and sandboxed with no scripts if a browser renders it', () => {
    const headers = {};
    setUntrustedFileHeaders({ setHeader: (name, value) => { headers[name] = value; } });
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Security-Policy']).toMatch(/default-src 'none'/);
    expect(headers['Content-Security-Policy']).toMatch(/sandbox/);
    expect(headers['Content-Security-Policy']).not.toMatch(/script-src/);
  });
});
