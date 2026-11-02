const { validateRegister } = require('./auth.validation');

describe('registration password policy', () => {
  test('requires at least eight characters', () => {
    const shortPassword = validateRegister('', '1234567', '', '');
    const validLength = validateRegister('', '12345678', '', '');

    expect(shortPassword.errors.password).toBe('Password must be at least 8 characters');
    expect(validLength.errors.password).toBeUndefined();
  });
});
