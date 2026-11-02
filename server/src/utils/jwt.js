const jwt = require('jsonwebtoken');
const config = require('../config');

exports.generateAccessToken = (userId, email, role, tokenVersion = 0) => {
  return jwt.sign(
    { userId, email, role, tokenVersion },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

exports.generateRefreshToken = (userId, tokenVersion = 0) => {
  return jwt.sign(
    { userId, tokenVersion },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

exports.verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
};

exports.verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (error) {
    return null;
  }
};

exports.decodeToken = (token) => {
  return jwt.decode(token);
};
