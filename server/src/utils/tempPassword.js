const crypto = require('crypto');
const { getPasswordError } = require('./passwordPolicy');

// Characters that are easy to read out or type: no 0/O, 1/l/I.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '@#$%&*!?';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const LENGTH = 14;

const pick = (chars) => chars[crypto.randomInt(chars.length)];

// Returns a new random temporary password (one of each character type, 14 long).
// Built only with crypto.randomInt, so every call gives an unpredictable value.
const generateTemporaryPassword = () => {
  for (;;) {
    const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
    while (chars.length < LENGTH) chars.push(pick(ALL));
    // Fisher-Yates shuffle so the required types aren't always first
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const password = chars.join('');
    if (!getPasswordError(password)) return password;
  }
};

module.exports = { generateTemporaryPassword };
