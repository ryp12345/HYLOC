const db = require('../config/db');

/**
 * Create or get leave entitlement for a user and year
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @param {number} leaveEntitled - Annual leave entitlement (default 0)
 * @returns {Promise<Object>} Entitlement record
 */
exports.createOrGetEntitlement = async (userId, year, leaveEntitled = 0.0) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Use UPSERT to avoid race conditions
    const upsertQuery = `
      INSERT INTO leaves_entitlement (
        user_id, year, leave_entitled, leaves_accumulated, leaves_availed
      )
      VALUES ($1, $2, $3, 0.0, 0.0)
      ON CONFLICT (user_id, year) DO NOTHING
    `;
    await client.query(upsertQuery, [userId, year, leaveEntitled]);
    
    // Get the record (whether it was just inserted or already existed)
    const getQuery = `
      SELECT * FROM leaves_entitlement
      WHERE user_id = $1 AND year = $2
    `;
    const result = await client.query(getQuery, [userId, year]);
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get entitlement by user ID and year
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @returns {Promise<Object|null>} Entitlement record or null
 */
exports.getEntitlementByUserAndYear = async (userId, year) => {
  const query = `
    SELECT * FROM leaves_entitlement
    WHERE user_id = $1 AND year = $2
  `;
  
  const result = await db.query(query, [userId, year]);
  return result.rows[0] || null;
};

/**
 * Get all entitlements for a user (all years)
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of entitlement records
 */
exports.getEntitlementsByUserId = async (userId) => {
  const query = `
    SELECT * FROM leaves_entitlement
    WHERE user_id = $1
    ORDER BY year DESC
  `;
  
  const result = await db.query(query, [userId]);
  return result.rows;
};

/**
 * Update leaves_availed for a user and year
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @param {number} adjustment - Amount to add/subtract (positive or negative)
 * @param {Object} client - Optional database client for transaction handling
 * @returns {Promise<Object>} Updated entitlement record
 */
exports.updateLeavesAvailed = async (userId, year, adjustment, client = null) => {
  const useExternalClient = !!client;
  if (!client) {
    client = await db.connect();
  }
  
  try {
    if (!useExternalClient) {
      await client.query('BEGIN');
    }
    
    // Use UPSERT to create record if doesn't exist, or do nothing if exists
    const upsertQuery = `
      INSERT INTO leaves_entitlement (
        user_id, year, leave_entitled, leaves_accumulated, leaves_availed
      )
      VALUES ($1, $2, 0.0, 0.0, 0.0)
      ON CONFLICT (user_id, year) DO NOTHING
    `;
    await client.query(upsertQuery, [userId, year]);
    
    // Update leaves_availed
    const updateQuery = `
      UPDATE leaves_entitlement
      SET leaves_availed = leaves_availed + $1
      WHERE user_id = $2 AND year = $3
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [adjustment, userId, year]);
    
    if (!useExternalClient) {
      await client.query('COMMIT');
    }
    
    return result.rows[0];
  } catch (error) {
    if (!useExternalClient) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (!useExternalClient) {
      client.release();
    }
  }
};

/**
 * Update entitlement record
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object|null>} Updated entitlement record
 */
exports.updateEntitlement = async (userId, year, updateData) => {
  const allowedFields = ['leave_entitled', 'leaves_accumulated', 'leaves_availed'];
  
  const setClause = [];
  const values = [];
  let paramCount = 0;
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key)) {
      paramCount++;
      setClause.push(`${key} = $${paramCount}`);
      values.push(updateData[key]);
    }
  });
  
  if (setClause.length === 0) {
    return null;
  }
  
  paramCount++;
  values.push(userId);
  paramCount++;
  values.push(year);
  
  const query = `
    UPDATE leaves_entitlement
    SET ${setClause.join(', ')}
    WHERE user_id = $${paramCount - 1} AND year = $${paramCount}
    RETURNING *
  `;
  
  const result = await db.query(query, values);
  return result.rows[0] || null;
};

/**
 * Calculate leave balance for a user and year
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @returns {Promise<Object>} Balance details
 */
exports.getLeaveBalance = async (userId, year) => {
  const entitlement = await exports.getEntitlementByUserAndYear(userId, year);
  
  if (!entitlement) {
    // Create default entitlement if doesn't exist
    const newEntitlement = await exports.createOrGetEntitlement(userId, year);
    return {
      user_id: userId,
      year: year,
      leave_entitled: parseFloat(newEntitlement.leave_entitled),
      leaves_accumulated: parseFloat(newEntitlement.leaves_accumulated),
      leaves_availed: parseFloat(newEntitlement.leaves_availed),
      leave_balance: parseFloat(newEntitlement.leave_entitled) + parseFloat(newEntitlement.leaves_accumulated) - parseFloat(newEntitlement.leaves_availed)
    };
  }
  
  const balance = parseFloat(entitlement.leave_entitled) + 
                  parseFloat(entitlement.leaves_accumulated) - 
                  parseFloat(entitlement.leaves_availed);
  
  return {
    user_id: userId,
    year: year,
    leave_entitled: parseFloat(entitlement.leave_entitled),
    leaves_accumulated: parseFloat(entitlement.leaves_accumulated),
    leaves_availed: parseFloat(entitlement.leaves_availed),
    leave_balance: balance
  };
};

/**
 * Get all balances for all users in a specific year
 * @param {number} year - Calendar year
 * @param {Object} filters - Optional filters (department_id)
 * @returns {Promise<Array>} Array of balance records with user details
 */
exports.getAllBalances = async (year, filters = {}) => {
  let query = `
    SELECT 
      le.id,
      le.user_id,
      COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '') as user_name,
      u.empid,
      u.department_id,
      d.department_name,
      le.year,
      le.leave_entitled,
      le.leaves_accumulated,
      le.leaves_availed,
      le.created_at,
      le.updated_at,
      (le.leave_entitled + le.leaves_accumulated - le.leaves_availed) as leave_balance
    FROM leaves_entitlement le
    LEFT JOIN users u ON le.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    WHERE le.year = $1
  `;
  
  const values = [year];
  let paramCount = 1;
  
  if (filters.department_id) {
    paramCount++;
    query += ` AND u.department_id = $${paramCount}`;
    values.push(filters.department_id);
  }
  
  query += ` ORDER BY u.empid ASC`;
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Bulk update entitlements (for HR operations)
 * @param {Array} updates - Array of {user_id, year, ...fields}
 * @returns {Promise<Array>} Array of updated records
 */
exports.bulkUpdateEntitlements = async (updates) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    const results = [];
    
    for (const update of updates) {
      const { user_id, year, ...fields } = update;
      
      // Ensure record exists
      await exports.createOrGetEntitlement(user_id, year);
      
      // Update the record
      const result = await exports.updateEntitlement(user_id, year, fields);
      if (result) {
        results.push(result);
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

/**
 * Calculate prorated entitlement based on join date
 * @param {Date} joinDate - User's join date
 * @param {number} annualEntitlement - Full year entitlement (default 12)
 * @returns {number} Prorated entitlement
 */
exports.calculateProratedEntitlement = (joinDate, annualEntitlement = 12) => {
  const join = new Date(joinDate);
  const currentYear = new Date().getFullYear();
  const joinYear = join.getFullYear();
  
  // If joined in previous years, return full entitlement
  if (joinYear < currentYear) {
    return annualEntitlement;
  }
  
  // If joined this year, prorate based on month
  const joinMonth = join.getMonth(); // 0-indexed (0 = January)
  const remainingMonths = 12 - joinMonth;
  
  return Math.round((remainingMonths * annualEntitlement / 12) * 10) / 10;
};

/**
 * Delete entitlement record
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @returns {Promise<boolean>} True if deleted
 */
exports.deleteEntitlement = async (userId, year) => {
  const query = `
    DELETE FROM leaves_entitlement
    WHERE user_id = $1 AND year = $2
    RETURNING id
  `;
  
  const result = await db.query(query, [userId, year]);
  return result.rowCount > 0;
};

/**
 * Get entitlement by its primary id
 * @param {number} id - Entitlement record id
 * @returns {Promise<Object|null>} Entitlement record or null
 */
exports.getEntitlementById = async (id) => {
  const query = `
    SELECT * FROM leaves_entitlement
    WHERE id = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};