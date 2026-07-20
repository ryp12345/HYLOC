const pool = require('../config/db');

const normalizeIdList = (values) => {
  const list = Array.isArray(values)
    ? values
    : values === undefined || values === null || values === ''
      ? []
      : [values];

  return [...new Set(list.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
};

const attachTicketAssignees = async (tickets, db = pool) => {
  const rows = Array.isArray(tickets) ? tickets : [];
  if (rows.length === 0) return rows;

  const ticketIds = rows.map((ticket) => Number(ticket.id)).filter((ticketId) => Number.isInteger(ticketId) && ticketId > 0);
  if (ticketIds.length === 0) return rows.map((ticket) => ({
    ...ticket,
    assigned_to_ids: normalizeIdList([ticket.assigned_to]),
  }));

  const assigneeResult = await db.query(
    `
      SELECT ticket_id, array_agg(user_id ORDER BY created_at ASC) AS assignee_ids
      FROM ticket_assignees
      WHERE ticket_id = ANY($1::int[])
      GROUP BY ticket_id
    `,
    [ticketIds]
  );

  const assigneesByTicketId = new Map();
  for (const row of assigneeResult.rows || []) {
    assigneesByTicketId.set(String(row.ticket_id), normalizeIdList(row.assignee_ids));
  }

  return rows.map((ticket) => {
    const assigneeIds = assigneesByTicketId.get(String(ticket.id)) || [];
    const combined = normalizeIdList([ticket.assigned_to, ...assigneeIds]);
    return {
      ...ticket,
      assigned_to_ids: combined,
    };
  });
};

const replaceTicketAssignees = async (db, ticketId, assigneeIds, assignedBy) => {
  const normalizedAssigneeIds = normalizeIdList(assigneeIds);

  await db.query('DELETE FROM ticket_assignees WHERE ticket_id = $1', [ticketId]);

  for (const userId of normalizedAssigneeIds) {
    await db.query(
      `
        INSERT INTO ticket_assignees (ticket_id, user_id, assigned_by, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `,
      [ticketId, userId, assignedBy || null]
    );
  }

  return normalizedAssigneeIds;
};

// Get all ticket priorities (enum values)
exports.getTicketPriorities = async () => {
  const result = await pool.query("SELECT unnest(enum_range(NULL::enum_tickets_priority)) AS value");
  return result.rows.map(row => row.value);
};

// ...other ticket model methods (CRUD) can be added here

// Create a ticket in the tickets table
exports.createTicket = async (data, db = pool) => {
  const query = `
    INSERT INTO tickets (title, description, priority, status, user_id, assigned_to, due_date, attachment, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING *
  `;
  const values = [
    data.title,
    data.description || '',
    data.priority || 'Medium',
    data.status || 'Open',
    data.user_id,
    data.assigned_to || null,
    data.due_date || null,
    data.attachment || null,
  ];
  const result = await db.query(query, values);
  return result.rows[0];
};

// Get all ticket statuses (enum values)
exports.getTicketStatuses = async () => {
  const result = await pool.query("SELECT unnest(enum_range(NULL::enum_tickets_status)) AS value");
  return result.rows.map(row => row.value);
};

// Get all tickets (unrestricted — internal use only)
exports.getAllTickets = async (db = pool) => {
  const result = await db.query('SELECT * FROM tickets ORDER BY created_at DESC');
  return await attachTicketAssignees(result.rows, db);
};

// Get tickets visible to a specific user based on role:
// - Management: all tickets
// - Employee / HOD: only tickets they created OR are assigned to
exports.getTicketsForUser = async (userId, role, db = pool) => {
  const roleNorm = role && typeof role === 'string' ? role.toLowerCase() : (role && role.name ? String(role.name).toLowerCase() : '');
  if (roleNorm === 'management') {
    const result = await db.query('SELECT * FROM tickets ORDER BY created_at DESC');
    return await attachTicketAssignees(result.rows, db);
  }

  // For HODs, include tickets created by Employees in the same department
  if (roleNorm === 'hod') {
    try {
      const deptRes = await db.query('SELECT department_id FROM users WHERE id = $1', [userId]);
      const deptId = deptRes.rows && deptRes.rows[0] ? deptRes.rows[0].department_id : null;
      if (!deptId) {
        // Fallback to creator/assignee only
        const fallback = await db.query(
          `
            SELECT * FROM tickets
            WHERE user_id = $1
              OR assigned_to = $1
              OR EXISTS (
                SELECT 1
                FROM ticket_assignees ta
                WHERE ta.ticket_id = tickets.id AND ta.user_id = $1
              )
            ORDER BY created_at DESC
          `,
          [userId]
        );
        return await attachTicketAssignees(fallback.rows, db);
      }

      const query = `
        SELECT t.*
        FROM tickets t
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.status = 'active'
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE t.user_id = $1
          OR t.assigned_to = $1
          OR EXISTS (
            SELECT 1
            FROM ticket_assignees ta
            WHERE ta.ticket_id = t.id AND ta.user_id = $1
          )
          OR (u.department_id = $2 AND LOWER(r.role_name) = 'employee')
        ORDER BY t.created_at DESC
      `;
      const result = await db.query(query, [userId, deptId]);
      return await attachTicketAssignees(result.rows, db);
    } catch (e) {
      // On error, fallback to minimal visibility
      console.error('getTicketsForUser (hod) error:', e);
      const fallback = await db.query(
        `
          SELECT * FROM tickets
          WHERE user_id = $1
            OR assigned_to = $1
            OR EXISTS (
              SELECT 1
              FROM ticket_assignees ta
              WHERE ta.ticket_id = tickets.id AND ta.user_id = $1
            )
          ORDER BY created_at DESC
        `,
        [userId]
      );
      return await attachTicketAssignees(fallback.rows, db);
    }
  }

  // Default: creator or assignee only
  const result = await db.query(
    `
      SELECT * FROM tickets
      WHERE user_id = $1
        OR assigned_to = $1
        OR EXISTS (
          SELECT 1
          FROM ticket_assignees ta
          WHERE ta.ticket_id = tickets.id AND ta.user_id = $1
        )
      ORDER BY created_at DESC
    `,
    [userId]
  );
  return await attachTicketAssignees(result.rows, db);
};

// Get ticket by id
exports.getTicketById = async (id, db = pool) => {
  const result = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
  const rows = await attachTicketAssignees(result.rows, db);
  return rows[0];
};

// Get tickets where user is creator OR assignee (used for "my tickets" endpoint)
exports.getTicketsByUserId = async (userId, db = pool) => {
  const result = await db.query(
    `
      SELECT * FROM tickets
      WHERE user_id = $1
        OR assigned_to = $1
        OR EXISTS (
          SELECT 1
          FROM ticket_assignees ta
          WHERE ta.ticket_id = tickets.id AND ta.user_id = $1
        )
      ORDER BY created_at DESC
    `,
    [userId]
  );
  return await attachTicketAssignees(result.rows, db);
};

exports.replaceTicketAssignees = async (db, ticketId, assigneeIds, assignedBy) => {
  return await replaceTicketAssignees(db, ticketId, assigneeIds, assignedBy);
};

// Update ticket
exports.updateTicket = async (id, data, db = pool) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
  if (data.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(data.priority); }
  if (data.user_id !== undefined) { fields.push(`user_id = $${idx++}`); values.push(data.user_id); }
  if (data.assigned_to !== undefined) { fields.push(`assigned_to = $${idx++}`); values.push(data.assigned_to); }
  if (data.due_date !== undefined) { fields.push(`due_date = $${idx++}`); values.push(data.due_date); }
  if (data.attachment !== undefined) { fields.push(`attachment = $${idx++}`); values.push(data.attachment); }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }
  if (data.rejected_by !== undefined) { fields.push(`rejected_by = $${idx++}`); values.push(data.rejected_by); }
  if (data.rejected_by_reason !== undefined) { fields.push(`rejected_by_reason = $${idx++}`); values.push(data.rejected_by_reason); }

  if (fields.length === 0) return await exports.getTicketById(id, db);

  const query = `UPDATE tickets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
  values.push(id);
  const result = await db.query(query, values);
  return result.rows[0];
};

// Delete ticket
exports.deleteTicket = async (id) => {
  const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};
