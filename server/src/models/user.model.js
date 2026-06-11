const db = require('../config/db');
const { hashPassword } = require('../utils/hash');

exports.createUser = async (userData) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    const hashedPassword = await hashPassword(userData.password);
    const userQuery = `
      INSERT INTO users (email, password, firstname, middlename, lastname, empid, phone, address, bloodgroup, department_id, designation_id, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id, email, firstname, middlename, lastname, empid, phone, address, bloodgroup, department_id, designation_id, status, created_at
    `;
    const userResult = await client.query(userQuery, [
      userData.email, 
      hashedPassword, 
      userData.firstName, 
      userData.middleName || null,
      userData.lastName,
      userData.empid || null,
      userData.phone || null,
      userData.address || null,
      userData.bloodGroup || null,
      userData.departmentId || null,
      userData.designationId || null,
      userData.status || 'active'
    ]);
    const user = userResult.rows[0];
    
    // Get role_id from roles table
    const roleIdQuery = 'SELECT id FROM roles WHERE role_name = $1';
    const roleIdResult = await client.query(roleIdQuery, [userData.role || 'employee']);
    const roleId = roleIdResult.rows[0]?.id;
    
    if (roleId) {
      // Insert role in user_roles junction table (use status column)
      const userRoleQuery = `
        INSERT INTO user_roles (user_id, role_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `;
      await client.query(userRoleQuery, [user.id, roleId, 'active']);
    }

    // Joining year gets 0 entitlement as per current business rule.
    const now = new Date();
    const year = now.getFullYear();
    const leaveEntitled = 0;

    // Don't create entitlement for Super admin accounts
    if (!userData.role || String(userData.role).toLowerCase() !== 'super admin') {
      const entitlementQuery = `
        INSERT INTO leaves_entitlement (
          user_id, year, leave_entitled, leaves_accumulated, leaves_availed
        )
        VALUES ($1, $2, $3, 0.0, 0.0)
        ON CONFLICT (user_id, year) DO NOTHING
      `;
      await client.query(entitlementQuery, [user.id, year, leaveEntitled]);
    }
    
    await client.query('COMMIT');
    
    // Return user with role
    return { ...user, role: userData.role || 'employee' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.findUserByEmail = async (email) => {
  const query = `
    SELECT u.* 
    FROM users u 
    WHERE u.email = $1
  `;
  const result = await db.query(query, [email]);
  return result.rows[0];
};

exports.findUserByEmpid = async (empid) => {
  const query = `
    SELECT u.* 
    FROM users u 
    WHERE u.empid = $1
  `;
  const result = await db.query(query, [empid]);
  return result.rows[0];
};

exports.findUserById = async (id) => {
  const query = `
    SELECT u.id, u.email, u.firstname, u.middlename, u.lastname, u.empid, 
           u.phone, u.address, u.bloodgroup, u.department_id, u.designation_id, 
           u.status, u.created_at
    FROM users u 
    WHERE u.id = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

exports.findUserWithPasswordById = async (id) => {
  const query = `
    SELECT u.*
    FROM users u
    WHERE u.id = $1
  `;
  const result = await db.query(query, [id]);
  return result.rows[0];
};

exports.updateUser = async (id, updates) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    const userFields = [];
    const userValues = [];
    let paramCount = 1;

    // Handle user table updates
    const userTableFields = ['firstname', 'lastname', 'email', 'password', 'status', 'empid', 'phone', 'address', 'bloodgroup', 'department_id', 'designation_id', 'middlename'];
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && userTableFields.includes(key)) {
        userFields.push(`${key} = $${paramCount}`);
        userValues.push(updates[key]);
        paramCount++;
      }
    });

    let user = null;
    if (userFields.length > 0) {
      userValues.push(id);
      const userQuery = `
        UPDATE users
        SET ${userFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING id, email, firstname, middlename, lastname, status, created_at, updated_at
      `;
      const userResult = await client.query(userQuery, userValues);
      user = userResult.rows[0];
    } else {
      // Get existing user data
      const getUserQuery = 'SELECT id, email, firstname, middlename, lastname, status, created_at, updated_at FROM users WHERE id = $1';
      const userResult = await client.query(getUserQuery, [id]);
      user = userResult.rows[0];
    }

    // Handle role update in user_roles table
    if (updates.role !== undefined) {
      // Get role_id from roles table
      const roleIdQuery = 'SELECT id FROM roles WHERE role_name = $1';
      const roleIdResult = await client.query(roleIdQuery, [updates.role]);
      const roleId = roleIdResult.rows[0]?.id;
      
      if (roleId) {
        // Mark existing roles inactive
        await client.query('UPDATE user_roles SET status = $1 WHERE user_id = $2', ['inactive', id]);

        // Insert new role (or update existing) with status active
        const roleQuery = `
          INSERT INTO user_roles (user_id, role_id, status, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          ON CONFLICT (user_id, role_id)
          DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
        `;
        await client.query(roleQuery, [id, roleId, 'active']);
        user.role = updates.role;
      }
    } else {
      // Get current active role
      const roleResult = await client.query(
        'SELECT r.role_name as role FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1 AND ur.status = $2 ORDER BY ur.created_at DESC LIMIT 1',
        [id, 'active']
      );
      user.role = roleResult.rows[0]?.role || 'employee';
    }

    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.deleteUser = async (id) => {
  const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
  const result = await db.query(query, [id]);
  return result.rows[0];
};

exports.getAllUsers = async () => {
  const query = `
    SELECT u.id, u.email, u.firstname, u.middlename, u.lastname, u.empid, 
           u.phone, u.address, u.bloodgroup, u.department_id, u.designation_id, 
           u.status, u.created_at,
           d.department_name,
           des.designation_name,
           COALESCE(r.role_name, 'employee') as role
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN designations des ON u.designation_id = des.id
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.status = 'active'
    LEFT JOIN roles r ON r.id = ur.role_id
    ORDER BY u.created_at DESC
  `;
  const result = await db.query(query);
  return result.rows;
};

/**
 * Get managers by department ID
 * @param {number} departmentId - Department ID
 * @returns {Promise<Array>} Array of manager users
 */
exports.getManagersByDepartment = async (departmentId) => {
  const query = `
    SELECT u.id, u.email, u.firstname, u.middlename, u.lastname, u.empid,
           u.phone, u.address, u.bloodgroup, u.department_id, u.designation_id,
           u.status, u.created_at
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id AND ur.status = 'active'
    JOIN roles r ON r.id = ur.role_id
    WHERE u.department_id = $1
      AND u.status = 'active'
      AND LOWER(r.role_name) = 'manager'
    ORDER BY u.firstname, u.lastname
  `;

  const result = await db.query(query, [departmentId]);
  return result.rows;
};

/**
 * Get users by department ID
 * @param {number} departmentId - Department ID
 * @returns {Promise<Array>} Array of users
 */
exports.getUsersByDepartment = async (departmentId) => {
  const query = `
    SELECT u.id, u.empid, u.firstname, u.middlename, u.lastname, u.email, 
           u.department_id, u.designation_id, u.status,
           d.department_name,
           des.designation_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN designations des ON u.designation_id = des.id
    WHERE u.department_id = $1 AND u.status = 'active'
    ORDER BY u.firstname, u.lastname
  `;
  
  const result = await db.query(query, [departmentId]);
  return result.rows;
};

/**
 * Get minimal users by department ID
 * @param {number} departmentId - Department ID
 * @returns {Promise<Array>} Array of users (minimal fields)
 */
exports.getUsersByDepartmentMinimal = async (departmentId) => {
  const query = `
    SELECT u.id, u.department_id, u.status
    FROM users u
    WHERE u.department_id = $1 AND u.status = 'active'
  `;

  const result = await db.query(query, [departmentId]);
  return result.rows;
};

exports.getAssignableUsers = async () => {
  // Use DISTINCT ON to ensure each user appears only once even if multiple
  // active role rows exist (defensive against inconsistent user_roles data).
  const query = `
    SELECT DISTINCT ON (u.id) u.id, u.firstname, u.lastname, u.email, COALESCE(r.role_name, 'employee') as role
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.status = 'active'
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.status = 'active'
    ORDER BY u.id, ur.created_at DESC, u.firstname, u.lastname
  `;
  const result = await db.query(query);
  return result.rows;
};
