const pool = require('../config/db');

// Get all ticket categories (enum values)
exports.getTicketCategories = async () => {
  const result = await pool.query("SELECT unnest(enum_range(NULL::enum_tickets_category)) AS value");
  return result.rows.map(row => row.value);
};

// Get all ticket priorities (enum values)
exports.getTicketPriorities = async () => {
  const result = await pool.query("SELECT unnest(enum_range(NULL::enum_tickets_priority)) AS value");
  return result.rows.map(row => row.value);
};

// ...other ticket model methods (CRUD) can be added here

// Create a ticket in the tickets table
exports.createTicket = async (data) => {
  const query = `
    INSERT INTO tickets (title, description, category, priority, status, user_id, assigned_to, due_date, attachment, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING *
  `;
  const values = [
    data.title,
    data.description || '',
    data.category || 'Other',
    data.priority || 'Medium',
    data.status || 'Open',
    data.user_id,
    data.assigned_to || null,
    data.due_date || null,
    data.attachment || null,
  ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Get all ticket statuses (enum values)
exports.getTicketStatuses = async () => {
  const result = await pool.query("SELECT unnest(enum_range(NULL::enum_tickets_status)) AS value");
  return result.rows.map(row => row.value);
};

// Get all tickets
exports.getAllTickets = async () => {
  const result = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
  return result.rows;
};

// Get ticket by id
exports.getTicketById = async (id) => {
  const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  return result.rows[0];
};

// Update ticket
exports.updateTicket = async (id, data) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
  if (data.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(data.priority); }
  if (data.user_id !== undefined) { fields.push(`user_id = $${idx++}`); values.push(data.user_id); }
  if (data.assigned_to !== undefined) { fields.push(`assigned_to = $${idx++}`); values.push(data.assigned_to); }
  if (data.due_date !== undefined) { fields.push(`due_date = $${idx++}`); values.push(data.due_date); }
  if (data.attachment !== undefined) { fields.push(`attachment = $${idx++}`); values.push(data.attachment); }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }

  if (fields.length === 0) return await exports.getTicketById(id);

  const query = `UPDATE tickets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
  values.push(id);
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Delete ticket
exports.deleteTicket = async (id) => {
  const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};
