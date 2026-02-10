const db = require('../config/db');

/**
 * Create a new leave application
 * @param {Object} leaveData - Leave application data
 * @returns {Promise<Object>} Created leave record
 */
exports.createLeave = async (leaveData) => {
  const query = `
    INSERT INTO leaves (
      user_id, from_date, to_date, leave_duration, credited_days,
      leave_reason, leave_type, alternate_person, additional_alternate,
      available_on_phone, status, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    RETURNING *
  `;
  
  const values = [
    leaveData.user_id,
    leaveData.from_date,
    leaveData.to_date,
    leaveData.leave_duration || 'Full Day',
    leaveData.credited_days,
    leaveData.leave_reason,
    leaveData.leave_type || 'Paid',
    leaveData.alternate_person || null,
    leaveData.additional_alternate || null,
    leaveData.available_on_phone !== undefined ? leaveData.available_on_phone : true,
    'Pending'
  ];
  
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Get leave by ID
 * @param {number} id - Leave ID
 * @returns {Promise<Object|null>} Leave record or null
 */
exports.getLeaveById = async (id) => {
  const query = `
    SELECT l.*, 
           u.firstname || ' ' || u.lastname as user_name,
           u.empid,
           approver.firstname || ' ' || approver.lastname as approver_name
    FROM leaves l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN users approver ON l.approved_by = approver.id
    WHERE l.id = $1
  `;
  
  const result = await db.query(query, [id]);
  return result.rows[0] || null;
};

/**
 * Get all leaves for a specific user
 * @param {number} userId - User ID
 * @param {Object} filters - Optional filters (status, year, etc.)
 * @returns {Promise<Array>} Array of leave records
 */
exports.getLeavesByUserId = async (userId, filters = {}) => {
  let query = `
    SELECT l.*, 
           u.firstname || ' ' || u.lastname as user_name,
           u.empid,
           approver.firstname || ' ' || approver.lastname as approver_name
    FROM leaves l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN users approver ON l.approved_by = approver.id
    WHERE l.user_id = $1
  `;
  
  const values = [userId];
  let paramCount = 1;
  
  if (filters.status) {
    paramCount++;
    query += ` AND l.status = $${paramCount}`;
    values.push(filters.status);
  }
  
  if (filters.year) {
    paramCount++;
    query += ` AND EXTRACT(YEAR FROM l.from_date) = $${paramCount}`;
    values.push(filters.year);
  }
  
  if (filters.from_date) {
    paramCount++;
    query += ` AND l.from_date >= $${paramCount}`;
    values.push(filters.from_date);
  }
  
  if (filters.to_date) {
    paramCount++;
    query += ` AND l.to_date <= $${paramCount}`;
    values.push(filters.to_date);
  }
  
  query += ` ORDER BY l.from_date DESC, l.created_at DESC`;
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Get all leaves (for admin/management use)
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of leave records
 */
exports.getAllLeaves = async (filters = {}) => {
  let query = `
    SELECT l.*, 
           u.firstname || ' ' || u.lastname as user_name,
           u.empid,
           u.department_id,
           d.department_name,
           COALESCE(user_role.role_name, 'Employee') as user_role,
           approver.firstname || ' ' || approver.lastname as approver_name
    FROM leaves l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN LATERAL (
      SELECT r.role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = u.id
      ORDER BY ur.id ASC
      LIMIT 1
    ) user_role ON TRUE
    LEFT JOIN users approver ON l.approved_by = approver.id
    WHERE 1=1
  `;
  
  const values = [];
  let paramCount = 0;
  
  if (filters.status) {
    paramCount++;
    query += ` AND l.status = $${paramCount}`;
    values.push(filters.status);
  }
  
  if (filters.department_id) {
    paramCount++;
    query += ` AND u.department_id = $${paramCount}`;
    values.push(filters.department_id);
  }
  
  if (filters.year) {
    paramCount++;
    query += ` AND EXTRACT(YEAR FROM l.from_date) = $${paramCount}`;
    values.push(filters.year);
  }
  
  if (filters.min_duration) {
    paramCount++;
    query += ` AND l.credited_days > $${paramCount}`;
    values.push(filters.min_duration);
  }
  
  query += ` ORDER BY l.from_date DESC, l.created_at DESC`;
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Update a leave record
 * @param {number} id - Leave ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object|null>} Updated leave record or null
 */
exports.updateLeave = async (id, updateData) => {
  const allowedFields = [
    'from_date', 'to_date', 'leave_duration', 'credited_days',
    'leave_reason', 'alternate_person', 'additional_alternate',
    'available_on_phone', 'status', 'approved_by',
    'rejection_reason', 'leave_type'
  ];
  
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
  values.push(id);
  
  const query = `
    UPDATE leaves
    SET ${setClause.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;
  
  const result = await db.query(query, values);
  return result.rows[0] || null;
};

/**
 * Delete a leave record
 * @param {number} id - Leave ID
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
exports.deleteLeave = async (id) => {
  const query = 'DELETE FROM leaves WHERE id = $1 RETURNING id';
  const result = await db.query(query, [id]);
  return result.rowCount > 0;
};

/**
 * Get leaves for a user in a specific year
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @returns {Promise<Array>} Array of leave records
 */
exports.getLeaveHistoryByYear = async (userId, year) => {
  const query = `
    SELECT l.*, 
           approver.firstname || ' ' || approver.lastname as approver_name
    FROM leaves l
    LEFT JOIN users approver ON l.approved_by = approver.id
    WHERE l.user_id = $1 
      AND EXTRACT(YEAR FROM l.from_date) = $2
    ORDER BY l.from_date ASC
  `;
  
  const result = await db.query(query, [userId, year]);
  return result.rows;
};

/**
 * Get pending leaves for approval (Manager/Management use)
 * @param {Object} filters - Filters like min_duration
 * @returns {Promise<Array>} Array of pending leave records
 */
exports.getPendingLeaves = async (filters = {}) => {
  let query = `
    SELECT l.*, 
           u.firstname || ' ' || u.lastname as user_name,
           u.empid,
           u.department_id,
           COALESCE(user_role.role_name, 'Employee') as user_role
    FROM leaves l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT r.role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = u.id
      ORDER BY ur.id ASC
      LIMIT 1
    ) user_role ON TRUE
    WHERE l.status = 'Pending'
  `;
  
  const values = [];
  let paramCount = 0;
  
  if (filters.min_duration) {
    paramCount++;
    query += ` AND l.credited_days > $${paramCount}`;
    values.push(filters.min_duration);
  }
  
  if (filters.department_id) {
    paramCount++;
    query += ` AND u.department_id = $${paramCount}`;
    values.push(filters.department_id);
  }
  
  query += ` ORDER BY l.created_at ASC`;
  
  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Get department leaves for Manager (Employee leaves only)
 * @param {Object} filters - Filters like department_id, status
 * @returns {Promise<Array>} Array of leave records
 */
exports.getDepartmentLeavesForManager = async (filters = {}) => {
  let query = `
    SELECT l.*, 
           u.firstname || ' ' || u.lastname as user_name,
           u.empid,
           u.department_id,
           d.department_name,
           user_role.role_name as user_role,
           approver.firstname || ' ' || approver.lastname as approver_name
    FROM leaves l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN LATERAL (
      SELECT r.role_name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = u.id
      ORDER BY ur.id ASC
      LIMIT 1
    ) user_role ON TRUE
    LEFT JOIN users approver ON l.approved_by = approver.id
    WHERE u.department_id = $1
      AND user_role.role_name = 'Employee'
  `;

  const values = [filters.department_id];
  let paramCount = 1;

  if (filters.status) {
    paramCount++;
    query += ` AND l.status = $${paramCount}`;
    values.push(filters.status);
  }

  query += ` ORDER BY l.created_at ASC`;

  const result = await db.query(query, values);
  return result.rows;
};

/**
 * Approve a leave
 * @param {number} leaveId - Leave ID
 * @param {number} approverId - ID of user approving
 * @returns {Promise<Object|null>} Updated leave record
 */
exports.approveLeave = async (leaveId, approverId) => {
  const query = `
    UPDATE leaves
    SET status = 'Approved',
        approved_by = $1
    WHERE id = $2
    RETURNING *
  `;
  
  const result = await db.query(query, [approverId, leaveId]);
  return result.rows[0] || null;
};

/**
 * Reject a leave
 * @param {number} leaveId - Leave ID
 * @param {number} rejectorId - ID of user rejecting
 * @returns {Promise<Object|null>} Updated leave record
 */
exports.rejectLeave = async (leaveId, rejectorId) => {
  const query = `
    UPDATE leaves
    SET status = 'Rejected',
        approved_by = $1
    WHERE id = $2
    RETURNING *
  `;

  const result = await db.query(query, [rejectorId, leaveId]);
  return result.rows[0] || null;
};

/**
 * Get total leaves availed by user in a year
 * @param {number} userId - User ID
 * @param {number} year - Calendar year
 * @returns {Promise<number>} Total credited days
 */
exports.getTotalAvailedInYear = async (userId, year) => {
  const query = `
    SELECT COALESCE(SUM(credited_days), 0) as total
    FROM leaves
    WHERE user_id = $1 
      AND EXTRACT(YEAR FROM from_date) = $2
      AND status IN ('Pending', 'Approved')
  `;
  
  const result = await db.query(query, [userId, year]);
  return parseFloat(result.rows[0].total);
};
