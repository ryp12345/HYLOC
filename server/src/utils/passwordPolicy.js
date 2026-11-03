// Shared password rules for every place a password is set
// (admin create/update/reset, change password, forgot-password reset).

const MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes; anything longer would be silently cut off.
const MAX_BYTES = 72;

// Widely used passwords that meet the length rule but are guessed first in attacks.
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '0123456789', '87654321', '11111111',
  '00000000', '12341234', '11223344', '12344321', '123123123', '1q2w3e4r',
  '1qaz2wsx', 'qwertyui', 'qwertyuiop', 'asdfghjk', 'asdfghjkl', 'zxcvbnm1',
  'password', 'password1', 'password12', 'password123', 'password@123',
  'password#123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'p@ssword1',
  'p@ssword123', 'pass@123', 'pass@1234', 'admin123', 'admin@123',
  'admin1234', 'administrator', 'welcome1', 'welcome123', 'welcome@123',
  'iloveyou', 'iloveyou1', 'sunshine', 'princess', 'football', 'baseball',
  'superman', 'starwars', 'trustno1', 'letmein1', 'master123', 'abcd1234',
  'abc12345', 'abcdefgh', 'qwerty12', 'qwerty123', 'qwerty@123', 'test1234',
  'test@123', 'changeme', 'changeme1', 'default1', 'computer', 'internet',
  'whatever', 'monkey123', 'dragon123', 'india123', 'india@123', 'user1234',
  'user@123', 'employee', 'employee1', 'employee123', 'company123',
  'hyloc123', 'hyloc@123', 'hyloc1234'
]);

// Returns an error message, or null when the password is acceptable.
const getPasswordError = (password) => {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Please enter a password.';
  }
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters long.`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_BYTES) {
    return `Password is too long. Please use no more than ${MAX_BYTES} characters.`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'This password is too common and easy to guess. Please choose a stronger password.';
  }
  if (/^(.)\1+$/.test(password)) {
    return 'Password cannot be the same character repeated. Please choose a stronger password.';
  }
  return null;
};

module.exports = { getPasswordError, MIN_LENGTH, MAX_BYTES };
