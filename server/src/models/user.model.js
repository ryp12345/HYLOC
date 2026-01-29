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
    const roleIdQuery = 'SELECT id FROM roles WHERE name = $1';
    const roleIdResult = await client.query(roleIdQuery, [userData.role || 'employee']);
    const roleId = roleIdResult.rows[0]?.id;
    
    if (roleId) {
      // Insert role in user_roles junction table
      const userRoleQuery = `
        INSERT INTO user_roles (user_id, role_id, is_active)
        VALUES ($1, $2, true)
      `;
      await client.query(userRoleQuery, [user.id, roleId]);
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
    SELECT u.id, u.email, u.firstname, u.lastname, u.created_at
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
        RETURNING id, email, firstname, lastname, status, created_at, updated_at
      `;
      const userResult = await client.query(userQuery, userValues);
      user = userResult.rows[0];
    } else {
      // Get existing user data
      const getUserQuery = 'SELECT id, email, firstname, lastname, status, created_at, updated_at FROM users WHERE id = $1';
      const userResult = await client.query(getUserQuery, [id]);
      user = userResult.rows[0];
    }

    // Handle role update in user_roles table
    if (updates.role !== undefined) {
      // Get role_id from roles table
      const roleIdQuery = 'SELECT id FROM roles WHERE name = $1';
      const roleIdResult = await client.query(roleIdQuery, [updates.role]);
      const roleId = roleIdResult.rows[0]?.id;
      
      if (roleId) {
        // Deactivate existing roles
        await client.query('UPDATE user_roles SET is_active = false WHERE user_id = $1', [id]);
        
        // Insert new role
        const roleQuery = `
          INSERT INTO user_roles (user_id, role_id, is_active)
          VALUES ($1, $2, true)
          ON CONFLICT (user_id, role_id) 
          DO UPDATE SET is_active = true, assigned_at = NOW()
        `;
        await client.query(roleQuery, [id, roleId]);
        user.role = updates.role;
      }
    } else {
      // Get current active role
      const roleResult = await client.query(
        'SELECT r.name as role FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1 AND ur.is_active = true ORDER BY ur.assigned_at DESC LIMIT 1',
        [id]
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
    SELECT u.id, u.email, u.firstname, u.lastname, u.empid, u.phone, u.address, u.bloodgroup, u.department_id, u.designation_id, u.status, u.created_at,
           d.department_name,
           des.designation_name
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN designations des ON u.designation_id = des.id
    ORDER BY u.created_at DESC
  `;
  const result = await db.query(query);
  return result.rows;
};
