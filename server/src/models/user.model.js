const db = require('../config/db');
const { hashPassword } = require('../utils/hash');

exports.createUser = async (email, password, firstName, lastName, role = 'employee') => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    const hashedPassword = await hashPassword(password);
    const userQuery = `
      INSERT INTO users (email, password, first_name, last_name, status, created_at)
      VALUES ($1, $2, $3, $4, 'active', NOW())
      RETURNING id, email, first_name, last_name, status, created_at
    `;
    const userResult = await client.query(userQuery, [email, hashedPassword, firstName, lastName]);
    const user = userResult.rows[0];
    
    // Get role_id from roles table
    const roleIdQuery = 'SELECT id FROM roles WHERE name = $1';
    const roleIdResult = await client.query(roleIdQuery, [role]);
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
    return { ...user, role };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.findUserByEmail = async (email) => {
  const query = `
    SELECT u.*, 
           COALESCE(
             (SELECT r.name FROM user_roles ur 
              JOIN roles r ON ur.role_id = r.id
              WHERE ur.user_id = u.id AND ur.is_active = true 
              ORDER BY ur.assigned_at DESC LIMIT 1), 
             'employee'
           ) as role
    FROM users u 
    WHERE u.email = $1
  `;
  const result = await db.query(query, [email]);
  return result.rows[0];
};

exports.findUserByEmpid = async (empid) => {
  const query = `
    SELECT u.*, 
           COALESCE(
             (SELECT r.name FROM user_roles ur 
              JOIN roles r ON ur.role_id = r.id
              WHERE ur.user_id = u.id AND ur.is_active = true 
              ORDER BY ur.assigned_at DESC LIMIT 1), 
             'employee'
           ) as role
    FROM users u 
    WHERE u.empid = $1
  `;
  const result = await db.query(query, [empid]);
  return result.rows[0];
};

exports.findUserById = async (id) => {
  const query = `
    SELECT u.id, u.email, u.first_name, u.last_name, u.status, u.created_at,
           COALESCE(
             (SELECT r.name FROM user_roles ur 
              JOIN roles r ON ur.role_id = r.id
              WHERE ur.user_id = u.id AND ur.is_active = true 
              ORDER BY ur.assigned_at DESC LIMIT 1), 
             'employee'
           ) as role
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
    const userTableFields = ['first_name', 'last_name', 'email', 'password', 'status'];
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
        RETURNING id, email, first_name, last_name, status, created_at, updated_at
      `;
      const userResult = await client.query(userQuery, userValues);
      user = userResult.rows[0];
    } else {
      // Get existing user data
      const getUserQuery = 'SELECT id, email, first_name, last_name, status, created_at, updated_at FROM users WHERE id = $1';
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
    SELECT u.id, u.email, u.first_name, u.last_name, u.status, u.created_at,
           COALESCE(
             (SELECT r.name FROM user_roles ur 
              JOIN roles r ON ur.role_id = r.id
              WHERE ur.user_id = u.id AND ur.is_active = true 
              ORDER BY ur.assigned_at DESC LIMIT 1), 
             'employee'
           ) as role
    FROM users u
    ORDER BY u.created_at DESC
  `;
  const result = await db.query(query);
  return result.rows;
};
