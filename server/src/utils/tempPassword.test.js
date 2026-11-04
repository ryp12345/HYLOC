const { generateTemporaryPassword } = require('./tempPassword');
const { getPasswordError } = require('./passwordPolicy');

describe('generateTemporaryPassword', () => {
  test('every generated password is unique', () => {
    const passwords = Array.from({ length: 2000 }, generateTemporaryPassword);
    expect(new Set(passwords).size).toBe(passwords.length);
  });

  test('passes the password policy and mixes all character types', () => {
    for (let i = 0; i < 200; i++) {
      const password = generateTemporaryPassword();
      expect(password).toHaveLength(14);
      expect(getPasswordError(password)).toBeNull();
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).toMatch(/[@#$%&*!?]/);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  test('is never the old shared default', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateTemporaryPassword()).not.toBe('Password@123');
    }
  });
});
