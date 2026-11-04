// Checks that temporary passwords reach the database only as bcrypt hashes,
// and that the forced-change flag is written (or refused) correctly.
jest.mock('../config/db', () => ({ connect: jest.fn(), query: jest.fn() }));
jest.mock('../utils/schema', () => ({
  columnExists: jest.fn(),
  optionalColumn: (rowRef, column, type) => `(to_jsonb(${rowRef})->>'${column}')::${type}`
}));

const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { columnExists } = require('../utils/schema');
const userModel = require('./user.model');

describe('user model: temporary passwords', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    columnExists.mockResolvedValue(true);
    client = {
      query: jest.fn(async (sql) => {
        if (/INSERT INTO users/.test(sql)) return { rows: [{ id: 9 }] };
        if (/UPDATE users/.test(sql)) return { rows: [{ id: 9, token_version: 4 }] };
        if (/SELECT id FROM roles/.test(sql)) return { rows: [{ id: 3 }] };
        return { rows: [] };
      }),
      release: jest.fn()
    };
    db.connect.mockResolvedValue(client);
  });

  const callFor = (pattern) => client.query.mock.calls.find(([sql]) => pattern.test(sql));

  test('createUser stores only a bcrypt hash and sets must_change_password', async () => {
    await userModel.createUser({
      email: 'a@b.c', password: 'Tmp#Pass2xyzQ9', firstName: 'A', lastName: 'B', mustChangePassword: true
    });

    const [sql, params] = callFor(/INSERT INTO users/);
    expect(sql).toContain('must_change_password');
    expect(params).not.toContain('Tmp#Pass2xyzQ9');
    expect(await bcrypt.compare('Tmp#Pass2xyzQ9', params[1])).toBe(true);
    expect(params[13]).toBe(true);
  });

  test('updateUser hashes the new password, sets the flag and ends existing sessions', async () => {
    await userModel.updateUser(9, { password: 'Tmp#Pass2xyzQ9', must_change_password: true });

    const [sql, params] = callFor(/UPDATE users/);
    expect(sql).toContain('must_change_password = $');
    expect(sql).toContain('token_version = token_version + 1');
    expect(params).not.toContain('Tmp#Pass2xyzQ9');
    expect(await bcrypt.compare('Tmp#Pass2xyzQ9', params[0])).toBe(true);
    expect(params).toContain(true);
  });

  test('refuses to issue a temporary password when migration 024 is missing', async () => {
    columnExists.mockResolvedValue(false);

    await expect(userModel.updateUser(9, { password: 'Tmp#Pass2xyzQ9', must_change_password: true }))
      .rejects.toThrow(/024_add_user_must_change_password/);
    expect(callFor(/UPDATE users/)).toBeUndefined();
  });

  test('clearing the flag still works before the migration (normal password changes keep working)', async () => {
    columnExists.mockResolvedValue(false);

    await userModel.updateUser(9, { password: 'MyOwn#Pass2026', must_change_password: false });

    const [sql] = callFor(/UPDATE users/);
    expect(sql).not.toContain('must_change_password');
  });
});
