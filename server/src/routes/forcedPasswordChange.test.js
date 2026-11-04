// End-to-end test of the temporary password + forced first-login change flow.
// Runs the real Express app, routes, middleware, bcrypt and JWT over HTTP.
// Only the database is replaced by a small in-memory users table.
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef012345678';

jest.mock('../config/db', () => ({
  query: jest.fn(async (sql, params = []) => {
    // Role lookups: user 1 is Admin, everyone else Employee
    if (/FROM user_roles/.test(sql)) {
      return { rows: [{ role_name: params[0] === 1 ? 'Admin' : 'Employee' }] };
    }
    return { rows: [] };
  }),
  connect: jest.fn()
}));

// Rate limits are tested elsewhere; this test logs in many times from one address
jest.mock('../middlewares/authRateLimit.middleware', () => {
  const pass = (req, res, next) => next();
  return { loginIpLimiter: pass, loginAccountLimiter: pass, passwordResetLimiter: pass };
});

jest.mock('../models/loginAttempt.model', () => ({
  getLockSecondsRemaining: jest.fn(async () => 0),
  recordFailure: jest.fn(async () => 0),
  clear: jest.fn(async () => {})
}));

jest.mock('../models/user.model', () => {
  const bcrypt = require('bcryptjs');
  const users = new Map();
  let nextId = 1;
  const strip = (u) => {
    if (!u) return u;
    const { password, ...rest } = u;
    return { ...rest };
  };
  const store = {
    users,
    async seed(data, plainPassword) {
      const user = {
        id: nextId++, status: 'active', token_version: 0, must_change_password: false, ...data,
        password: await bcrypt.hash(plainPassword, 4)
      };
      users.set(user.id, user);
      return user;
    },
    findUserByEmpid: async (empid) => [...users.values()].find((u) => u.empid === empid),
    findUserByEmail: async (email) => [...users.values()].find((u) => u.email === email),
    findUserById: async (id) => strip(users.get(Number(id))),
    findUserWithPasswordById: async (id) => users.get(Number(id)),
    getActiveRoles: async (id) => [Number(id) === 1 ? 'Admin' : 'Employee'],
    async createUser(data) {
      const user = await store.seed({
        email: data.email, empid: data.empid, firstname: data.firstName, lastname: data.lastName,
        must_change_password: Boolean(data.mustChangePassword)
      }, data.password);
      return strip(user);
    },
    async updateUser(id, updates) {
      const user = users.get(Number(id));
      if (updates.password !== undefined) user.password = await bcrypt.hash(updates.password, 4);
      if (updates.must_change_password !== undefined) user.must_change_password = Boolean(updates.must_change_password);
      if (updates.password !== undefined || updates.status !== undefined) user.token_version += 1;
      return strip(user);
    }
  };
  return store;
});

const bcrypt = require('bcryptjs');
const userStore = require('../models/user.model');
const app = require('../app');

let server;
let baseUrl;
let consoleOutput;

const api = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, body: json, headers: response.headers };
};

const login = (empid, password) => api('POST', '/api/auth/login', { body: { empid, password } });

beforeAll(async () => {
  consoleOutput = [];
  for (const level of ['log', 'error', 'warn', 'info']) {
    jest.spyOn(console, level).mockImplementation((...args) => {
      consoleOutput.push(args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' '));
    });
  }
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  jest.restoreAllMocks();
});

describe('temporary password and forced first-login change', () => {
  let admin;
  let employee;
  let normalUser;
  let adminToken;

  beforeAll(async () => {
    admin = await userStore.seed({ empid: 'A1', email: 'admin@x.test', firstname: 'Ad', lastname: 'Min' }, 'Admin#Pass2026x');
    employee = await userStore.seed({ empid: 'E2', email: 'emp@x.test', firstname: 'Em', lastname: 'Ployee' }, 'Old#Pass2026xy');
    normalUser = await userStore.seed({ empid: 'E3', email: 'other@x.test', firstname: 'Ot', lastname: 'Her' }, 'Other#Pass2026');
    adminToken = (await login('A1', 'Admin#Pass2026x')).body.data.accessToken;
  });

  let earlierSession;
  let temporaryPassword;
  let pendingSession;
  let newSession;

  test('reset invalidates every existing session', async () => {
    earlierSession = (await login('E2', 'Old#Pass2026xy')).body.data;
    expect((await api('GET', '/api/users/me', { token: earlierSession.accessToken })).status).toBe(200);

    const reset = await api('PATCH', `/api/users/${employee.id}/reset-password`, { token: adminToken, body: {} });
    expect(reset.status).toBe(200);
    temporaryPassword = reset.body.data.temporaryPassword;

    expect((await api('GET', '/api/users/me', { token: earlierSession.accessToken })).status).toBe(401);
    expect((await api('POST', '/api/auth/refresh-token', { body: { refreshToken: earlierSession.refreshToken } })).status).toBe(401);
  });

  test('reset returns a unique temporary password once, stores only its hash, and is not cached', async () => {
    const stored = userStore.users.get(employee.id);
    expect(temporaryPassword).toHaveLength(14);
    expect(temporaryPassword).not.toBe('Password@123');
    expect(stored.password).not.toBe(temporaryPassword);
    expect(await bcrypt.compare(temporaryPassword, stored.password)).toBe(true);
    expect(stored.must_change_password).toBe(true);

    const resetAgain = await api('PATCH', `/api/users/${normalUser.id}/reset-password`, { token: adminToken, body: { password: 'Password@123' } });
    expect(resetAgain.headers.get('cache-control')).toBe('no-store');
    expect(resetAgain.body.data.temporaryPassword).not.toBe(temporaryPassword);
    expect(resetAgain.body.data.temporaryPassword).not.toBe('Password@123');
    // Put the "normal user" back to a regular account for the later test
    await userStore.updateUser(normalUser.id, { password: 'Other#Pass2026', must_change_password: false });
  });

  test('the old password stops working after the reset', async () => {
    expect((await login('E2', 'Old#Pass2026xy')).status).toBe(401);
  });

  test('login with the temporary password succeeds but reports the mandatory change', async () => {
    const result = await login('E2', temporaryPassword);
    expect(result.status).toBe(200);
    expect(result.body.data.user.mustChangePassword).toBe(true);
    pendingSession = result.body.data;
  });

  test('every other API is blocked until the password is changed', async () => {
    const token = pendingSession.accessToken;
    const blocked = [
      ['GET', '/api/users/me'],
      ['GET', '/api/users'],
      ['GET', '/api/leaves/my-leaves'],
      ['GET', '/api/tickets'],
      ['GET', '/api/kpis'],
      ['GET', '/api/notifications/my'],
      ['GET', '/api/departments'],
      ['POST', '/api/auth/switch-role']
    ];
    for (const [method, path] of blocked) {
      const result = await api(method, path, { token, body: method === 'POST' ? { role: 'Employee' } : undefined });
      expect({ path, status: result.status, code: result.body?.errors?.code })
        .toEqual({ path, status: 403, code: 'PASSWORD_CHANGE_REQUIRED' });
    }
  });

  test('a refreshed token is blocked too (no bypass through refresh)', async () => {
    const refreshed = await api('POST', '/api/auth/refresh-token', { body: { refreshToken: pendingSession.refreshToken } });
    expect(refreshed.status).toBe(200);
    expect((await api('GET', '/api/users/me', { token: refreshed.body.data.accessToken })).status).toBe(403);
  });

  test('profile stays reachable and reports the pending change', async () => {
    const profile = await api('GET', '/api/auth/profile', { token: pendingSession.accessToken });
    expect(profile.status).toBe(200);
    expect(profile.body.data.mustChangePassword).toBe(true);
  });

  test('change is refused without confirmation, with a mismatch, a weak password, or re-using the temporary one', async () => {
    const token = pendingSession.accessToken;
    const attempt = (body) => api('POST', '/api/auth/change-password', { token, body });

    expect((await attempt({ currentPassword: temporaryPassword, newPassword: 'New#Pass2026ab' })).status).toBe(400);
    expect((await attempt({ currentPassword: temporaryPassword, newPassword: 'New#Pass2026ab', confirmPassword: 'Other#2026abcd' })).status).toBe(400);
    expect((await attempt({ currentPassword: temporaryPassword, newPassword: 'password123', confirmPassword: 'password123' })).status).toBe(400);
    expect((await attempt({ currentPassword: 'wrong-one', newPassword: 'New#Pass2026ab', confirmPassword: 'New#Pass2026ab' })).status).toBe(400);

    const reuse = await attempt({ currentPassword: temporaryPassword, newPassword: temporaryPassword, confirmPassword: temporaryPassword });
    expect(reuse.status).toBe(400);
    expect(reuse.body.message).toMatch(/different/);
    expect(userStore.users.get(employee.id).must_change_password).toBe(true);
  });

  test('a successful change clears the flag and returns a fresh session', async () => {
    const result = await api('POST', '/api/auth/change-password', {
      token: pendingSession.accessToken,
      body: { currentPassword: temporaryPassword, newPassword: 'New#Pass2026ab', confirmPassword: 'New#Pass2026ab' }
    });
    expect(result.status).toBe(200);
    expect(result.body.data.accessToken).toBeTruthy();
    expect(result.body.data.refreshToken).toBeTruthy();
    expect(userStore.users.get(employee.id).must_change_password).toBe(false);
    newSession = result.body.data;
  });

  test('access is restored with the new session; the temporary-password session is ended', async () => {
    expect((await api('GET', '/api/users/me', { token: newSession.accessToken })).status).toBe(200);
    expect((await api('GET', '/api/leaves/my-leaves', { token: newSession.accessToken })).status).toBe(200);
    expect((await api('GET', '/api/users/me', { token: pendingSession.accessToken })).status).toBe(401);
  });

  test('the temporary password is rejected afterwards; the new one works without a forced change', async () => {
    expect((await login('E2', temporaryPassword)).status).toBe(401);
    const result = await login('E2', 'New#Pass2026ab');
    expect(result.status).toBe(200);
    expect(result.body.data.user.mustChangePassword).toBe(false);
  });

  test('normal users are unaffected', async () => {
    const result = await login('E3', 'Other#Pass2026');
    expect(result.status).toBe(200);
    expect(result.body.data.user.mustChangePassword).toBe(false);
    expect((await api('GET', '/api/users/me', { token: result.body.data.accessToken })).status).toBe(200);
    expect((await api('GET', '/api/users', { token: adminToken })).status).not.toBe(403);
  });

  test('new accounts get a generated temporary password (any password sent is ignored)', async () => {
    const created = await api('POST', '/api/users', {
      token: adminToken,
      body: { email: 'new@x.test', empid: 'E9', firstName: 'New', lastName: 'Person', password: 'Password@123' }
    });
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const tempForNew = created.body.data.temporaryPassword;
    expect(tempForNew).toHaveLength(14);
    expect(tempForNew).not.toBe('Password@123');

    expect((await login('E9', 'Password@123')).status).toBe(401);
    const first = await login('E9', tempForNew);
    expect(first.body.data.user.mustChangePassword).toBe(true);
    expect((await api('GET', '/api/users/me', { token: first.body.data.accessToken })).status).toBe(403);
  });

  test('temporary passwords are never written to the server logs', () => {
    const logs = consoleOutput.join('\n');
    expect(logs).not.toContain(temporaryPassword);
  });
});
