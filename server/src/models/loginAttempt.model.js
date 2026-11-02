const db = require('../config/db');

// Seconds left on the account's lock, or 0 when it is not locked.
// Worked out in the database so server time zones cannot skew it.
const LOCK_SECONDS_LEFT = `GREATEST(CEIL(EXTRACT(EPOCH FROM (locked_until - NOW()))), 0)::int`;

exports.getLockSecondsRemaining = async (userId) => {
  const result = await db.query(
    `SELECT ${LOCK_SECONDS_LEFT} AS seconds_left
     FROM login_attempts
     WHERE user_id = $1 AND locked_until > NOW()`,
    [userId]
  );
  return result.rows[0]?.seconds_left || 0;
};

// Records a failed login. Returns the seconds left on the lock when this
// failure locked the account, otherwise 0.
exports.recordFailure = async (userId) => {
  const result = await db.query(
    `INSERT INTO login_attempts (user_id, failed_attempts, locked_until, updated_at)
     VALUES ($1, 1, NULL, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET
       failed_attempts = CASE
         WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until <= NOW() THEN 1
         ELSE login_attempts.failed_attempts + 1
       END,
       locked_until = CASE
         WHEN login_attempts.locked_until IS NOT NULL AND login_attempts.locked_until <= NOW() THEN NULL
         WHEN login_attempts.failed_attempts + 1 >= 10 THEN NOW() + INTERVAL '15 minutes'
         ELSE login_attempts.locked_until
       END,
       updated_at = NOW()
     RETURNING CASE WHEN locked_until > NOW() THEN ${LOCK_SECONDS_LEFT} ELSE 0 END AS seconds_left`,
    [userId]
  );
  return result.rows[0]?.seconds_left || 0;
};

exports.clear = async (userId) => {
  await db.query('DELETE FROM login_attempts WHERE user_id = $1', [userId]);
};
