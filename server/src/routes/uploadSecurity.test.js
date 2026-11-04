// End-to-end upload security test: real Express app, routes, multer and
// validators, over HTTP. The database is replaced by an in-memory user.
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef012345678';

jest.mock('../config/db', () => ({ query: jest.fn(async () => ({ rows: [] })), connect: jest.fn() }));
jest.mock('../models/user.model', () => {
  const user = {
    id: 7, email: 'emp@x.test', firstname: 'Em', lastname: 'Ployee', empid: '7007',
    status: 'active', token_version: 0, must_change_password: false, staff_photo: null
  };
  return {
    user,
    findUserById: async () => ({ ...user }),
    findUserByEmail: async (email) => (email === user.email ? { ...user } : undefined),
    getActiveRoles: async () => ['Employee'],
    updateUser: async (id, updates) => {
      Object.assign(user, updates);
      return { ...user };
    }
  };
});

const fs = require('fs');
const path = require('path');
const { generateAccessToken } = require('../utils/jwt');
const app = require('../app');

const usersDir = path.join(__dirname, '../../public/uploads/users');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)
]);

let server;
let baseUrl;
let token;
let filesBefore;

const listUploads = () => new Set(fs.existsSync(usersDir) ? fs.readdirSync(usersDir) : []);
const newUploads = () => [...listUploads()].filter((f) => !filesBefore.has(f));
const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

const uploadPhoto = async (fileName, content, type, fields = {}) => {
  const form = new FormData();
  const body = { firstName: 'Em', lastName: 'Ployee', email: 'emp@x.test', ...fields };
  Object.entries(body).forEach(([key, value]) => form.append(key, value));
  if (content) form.append('staffPhoto', new Blob([content], { type }), fileName);
  const response = await fetch(`${baseUrl}/api/users/me`, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form
  });
  await settle();
  return { status: response.status, body: await response.json().catch(() => null) };
};

beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  filesBefore = listUploads();
  token = generateAccessToken(7, 'emp@x.test', 'Employee', 0);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  // Remove only the files this test created
  newUploads().forEach((f) => fs.rmSync(path.join(usersDir, f), { force: true }));
  await new Promise((resolve) => server.close(resolve));
  jest.restoreAllMocks();
});

describe('profile photo upload (real HTTP)', () => {
  test.each([
    ['an HTML page', 'evil.html', '<script>alert(1)</script>', 'text/html'],
    ['an SVG with script', 'evil.svg', '<svg onload="alert(1)"/>', 'image/svg+xml'],
    ['a program renamed .jpg', 'photo.jpg', Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0]), 'image/jpeg'],
    ['a double extension', 'shell.php.png', '<?php system($_GET[0]); ?>', 'image/png'],
    ['script content with an image type', 'x.png', '<script>alert(1)</script>', 'image/png']
  ])('rejects %s and keeps nothing on disk', async (_label, name, content, type) => {
    const result = await uploadPhoto(name, content, type);
    expect(result.status).toBe(400);
    expect(newUploads()).toEqual([]);
  });

  test('rejects a file over 5 MB with 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
    const result = await uploadPhoto('big.png', big, 'image/png');
    expect(result.status).toBe(413);
    expect(newUploads()).toEqual([]);
  });

  test('a valid photo in a request that fails validation is not kept', async () => {
    const result = await uploadPhoto('ok.png', PNG, 'image/png', { firstName: '<img src=x onerror=alert(1)>' });
    expect(result.status).toBe(400);
    expect(newUploads()).toEqual([]);
  });

  test('a valid photo is stored under a random name with a safe extension', async () => {
    const result = await uploadPhoto('My Photo.PNG', PNG, 'image/png');
    expect(result.status).toBe(200);
    const stored = newUploads();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatch(/^[0-9a-f]{32}\.png$/);
  });

  test('a served photo is never sniffed and is sandboxed', async () => {
    const [stored] = newUploads();
    const response = await fetch(`${baseUrl}/api/uploads/users/${stored}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toMatch(/sandbox/);
    expect(response.headers.get('content-type')).toMatch(/^image\/png/);
  });

  test('photos are not readable without logging in', async () => {
    const [stored] = newUploads();
    expect((await fetch(`${baseUrl}/api/uploads/users/${stored}`)).status).toBe(401);
  });
});
