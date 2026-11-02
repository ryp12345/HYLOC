const db = require('../config/db');

exports.createRequest = async (userId, otpHash) => {
  const result = await db.query(
    `INSERT INTO password_reset_requests (user_id, otp_hash, expires_at, attempts)
     VALUES ($1, $2, NOW() + INTERVAL '5 minutes', 0)
     ON CONFLICT (user_id)
     DO UPDATE SET otp_hash = EXCLUDED.otp_hash,
                   expires_at = EXCLUDED.expires_at,
                   attempts = 0,
                   created_at = NOW()
     RETURNING id`,
    [userId, otpHash]
  );
  return result.rows[0];
};

exports.findActiveRequest = async (userId) => {
  const result = await db.query(
    `SELECT id, otp_hash
     FROM password_reset_requests
     WHERE user_id = $1 AND expires_at > NOW() AND attempts < 5`,
    [userId]
  );
  return result.rows[0];
};

exports.recordFailedAttempt = async (requestId) => {
  await db.query(
    `UPDATE password_reset_requests
     SET attempts = attempts + 1
     WHERE id = $1 AND expires_at > NOW() AND attempts < 5`,
    [requestId]
  );
};

exports.consumeRequest = async (requestId) => {
  const result = await db.query(
    'DELETE FROM password_reset_requests WHERE id = $1 RETURNING id',
    [requestId]
  );
  return result.rowCount > 0;
};
