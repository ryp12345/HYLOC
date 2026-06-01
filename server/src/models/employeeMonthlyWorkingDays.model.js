const db = require('../config/db');

const MONTH_COLUMN_BY_NUMBER = {
  1: 'jan_duration',
  2: 'feb_duration',
  3: 'mar_duration',
  4: 'apr_duration',
  5: 'may_duration',
  6: 'jun_duration',
  7: 'jul_duration',
  8: 'aug_duration',
  9: 'sep_duration',
  10: 'oct_duration',
  11: 'nov_duration',
  12: 'dec_duration'
};

const getMonthColumn = (month) => {
  const monthNumber = Number(month);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Valid month (1-12) is required');
  }

  return MONTH_COLUMN_BY_NUMBER[monthNumber];
};

const buildMonthSelectExpression = (month) => {
  const monthColumn = getMonthColumn(month);
  return `emwd.${monthColumn} AS no_of_days`;
};

exports.getResolvedColumns = async () => ({
  mode: 'yearly_wide',
  id: 'id',
  userId: 'user_id',
  year: 'year',
  monthColumns: MONTH_COLUMN_BY_NUMBER,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

exports.getUserJoinCondition = (columns, monthlyAlias = 'emwd', userAlias = 'u') => {
  return `${userAlias}.id = ${monthlyAlias}.${columns.userId}`;
};

exports.getReferenceColumn = (columns) => columns.userId;
exports.getMonthColumn = getMonthColumn;

exports.getMonthlyWorkingDays = async (year, month) => {
  const monthColumn = getMonthColumn(month);
  const query = `
    SELECT
      emwd.id,
      emwd.user_id,
      emwd.year,
      ${buildMonthSelectExpression(month)},
      emwd.created_at,
      emwd.updated_at,
      COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') AS user_name,
      u.empid,
      u.department_id,
      d.department_name
    FROM employee_monthly_working_days emwd
    LEFT JOIN users u ON u.id = emwd.user_id
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE emwd.year = $1
    ORDER BY u.empid ASC
  `;

  const result = await db.query(query, [year]);
  return result.rows.map((row) => ({
    ...row,
    month,
    month_column: monthColumn
  }));
};

exports.getMonthlyWorkingDaysByUser = async (userId, year, month) => {
  const monthColumn = getMonthColumn(month);
  const query = `
    SELECT
      emwd.id,
      emwd.user_id,
      emwd.year,
      emwd.${monthColumn} AS no_of_days,
      emwd.created_at,
      emwd.updated_at
    FROM employee_monthly_working_days emwd
    WHERE emwd.user_id = $1 AND emwd.year = $2
  `;

  const result = await db.query(query, [userId, year]);
  if (!result.rows[0]) {
    return null;
  }

  return {
    ...result.rows[0],
    month,
    month_column: monthColumn
  };
};

exports.upsertMonthlyWorkingDays = async (userId, year, month, noOfDays) => {
  const monthColumn = getMonthColumn(month);
  const query = `
    INSERT INTO employee_monthly_working_days (
      user_id,
      year,
      ${monthColumn}
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, year)
    DO UPDATE SET
      ${monthColumn} = EXCLUDED.${monthColumn},
      updated_at = NOW()
    RETURNING *
  `;

  const result = await db.query(query, [userId, year, noOfDays]);
  return result.rows[0] || null;
};

exports.bulkUpsertMonthlyWorkingDays = async (entries) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const results = [];
    for (const entry of entries) {
      const monthColumn = getMonthColumn(entry.month);
      const result = await client.query(
        `
          INSERT INTO employee_monthly_working_days (
            user_id,
            year,
            ${monthColumn}
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, year)
          DO UPDATE SET
            ${monthColumn} = EXCLUDED.${monthColumn},
            updated_at = NOW()
          RETURNING *
        `,
        [entry.user_id, entry.year, entry.no_of_days]
      );

      if (result.rows[0]) {
        results.push(result.rows[0]);
      }
    }

    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.getYearlyWorkingDaysTotals = async (year) => {
  const query = `
    SELECT
      user_id,
      year,
      COALESCE(jan_duration, 0) +
      COALESCE(feb_duration, 0) +
      COALESCE(mar_duration, 0) +
      COALESCE(apr_duration, 0) +
      COALESCE(may_duration, 0) +
      COALESCE(jun_duration, 0) +
      COALESCE(jul_duration, 0) +
      COALESCE(aug_duration, 0) +
      COALESCE(sep_duration, 0) +
      COALESCE(oct_duration, 0) +
      COALESCE(nov_duration, 0) +
      COALESCE(dec_duration, 0) AS total_no_of_days
    FROM employee_monthly_working_days
    WHERE year = $1
  `;

  const result = await db.query(query, [year]);
  return result.rows;
};
