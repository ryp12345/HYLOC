// Security regression tests for audit finding L5 (weak password policy).
const { getPasswordError } = require('./passwordPolicy');

describe('password policy', () => {
  test('keeps the 8-character minimum', () => {
    expect(getPasswordError('Ab3$xyz')).toBe('Password must be at least 8 characters long.');
    expect(getPasswordError('Ab3$xyzQ')).toBeNull();
  });

  test('rejects common passwords regardless of case', () => {
    expect(getPasswordError('password123')).toMatch(/too common/);
    expect(getPasswordError('Password@123')).toMatch(/too common/);
    expect(getPasswordError('12345678')).toMatch(/too common/);
  });

  test('rejects a single repeated character', () => {
    expect(getPasswordError('aaaaaaaaaa')).toMatch(/repeated/);
  });

  test('rejects passwords longer than bcrypt can use (72 bytes)', () => {
    expect(getPasswordError('a1'.repeat(36))).toBeNull();
    expect(getPasswordError('a1'.repeat(36) + 'X')).toMatch(/too long/);
    // Multi-byte characters count by bytes, not letters
    expect(getPasswordError('é'.repeat(37))).toMatch(/too long/);
  });

  test('rejects non-string values such as arrays or objects', () => {
    expect(getPasswordError(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])).toBe('Please enter a password.');
    expect(getPasswordError({ length: 20 })).toBe('Please enter a password.');
    expect(getPasswordError(undefined)).toBe('Please enter a password.');
  });
});
