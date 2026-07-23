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
    assigned_to_ids: normalizeIdList(ticket.assigned_to_ids),
  }));

  const assigneeResult = await db.query(
    `
      SELECT ticket_id, array_agg(assigned_to ORDER BY created_at ASC) AS assignee_ids
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
    return {
      ...ticket,
      assigned_to_ids: [...assigneeIds],
    };
  });
};

const replaceTicketAssignees = async (db, ticketId, assigneeIds, assignedBy) => {
  const normalizedAssigneeIds = normalizeIdList(assigneeIds);

  await db.query('DELETE FROM ticket_assignees WHERE ticket_id = $1', [ticketId]);

  for (const userId of normalizedAssigneeIds) {
    await db.query(
      `
        INSERT INTO ticket_assignees (ticket_id, assigned_to, assigned_by, created_at, updated_at)
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

exports.getTicketReportsData = async (userId, role, fiscalYear = null, db = pool) => {
  const roleNorm = role && typeof role === 'string' ? role.toLowerCase() : (role && role.name ? String(role.name).toLowerCase() : '');
  const isManagement = roleNorm === 'management';
  const isHod = roleNorm === 'hod';

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultFy = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fiscalYearToUse = Number.isFinite(fiscalYear) ? fiscalYear : defaultFy;
  const fyStart = `${fiscalYearToUse}-04-01`;
  const fyEnd = `${fiscalYearToUse + 1}-04-01`;

  let tickets = [];
  if (isManagement) {
    const result = await db.query(
      `SELECT t.id, t.title, t.priority, t.status, t.user_id, t.due_date, t.created_at, t.updated_at,
              d.department_name AS department
       FROM tickets t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE t.created_at >= $1::date AND t.created_at < $2::date
       ORDER BY t.created_at DESC`,
      [fyStart, fyEnd]
    );
    tickets = result.rows || [];
  } else {
    const base =
      `SELECT t.id, t.title, t.priority, t.status, t.user_id, t.due_date, t.created_at, t.updated_at,
              d.department_name AS department
       FROM tickets t
       LEFT JOIN users u ON u.id = t.user_id
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE t.created_at >= $1::date AND t.created_at < $2::date
         AND (t.user_id = $3 OR EXISTS (SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = t.id AND ta.assigned_to = $3))`;

    if (isHod) {
      const deptRes = await db.query('SELECT department_id FROM users WHERE id = $1', [userId]);
      const hodDeptId = deptRes.rows?.[0]?.department_id || null;

      if (!hodDeptId) {
        const result = await db.query(base + ' ORDER BY t.created_at DESC', [fyStart, fyEnd, userId]);
        tickets = result.rows || [];
      } else {
        const hodQuery = `
          SELECT t.id, t.title, t.priority, t.status, t.user_id, t.due_date, t.created_at, t.updated_at,
                 d.department_name AS department
          FROM tickets t
          LEFT JOIN users u ON u.id = t.user_id
          LEFT JOIN departments d ON d.id = u.department_id
          WHERE t.created_at >= $1::date AND t.created_at < $2::date
            AND ((t.user_id = $3 OR EXISTS (SELECT 1 FROM ticket_assignees ta WHERE ta.ticket_id = t.id AND ta.assigned_to = $3))
              OR (u.department_id = $4 AND EXISTS (
                  SELECT 1 FROM user_roles ur2
                  JOIN roles r2 ON r2.id = ur2.role_id
                  WHERE ur2.user_id = u.id AND ur2.status = 'active'
                    AND LOWER(r2.role_name) = 'employee'
              )))
          ORDER BY t.created_at DESC`;
        const result = await db.query(hodQuery, [fyStart, fyEnd, userId, hodDeptId]);
        tickets = result.rows || [];
      }
    } else {
      const result = await db.query(base + ' ORDER BY t.created_at DESC', [fyStart, fyEnd, userId]);
      tickets = result.rows || [];
    }
  }

  tickets = await attachTicketAssignees(tickets, db);

  const statusDistribution = {};
  const priorityDistribution = {};
  const departmentBreakdown = {};
  const topCreators = {};
  const monthlyTrends = {};
  const overdueTickets = [];
  const openTickets = [];
  let totalResolutionTimeSum = 0;
  let totalResolutionCount = 0;
  const OPEN_STATUSES = ['open', 'assigned', 'in progress', 'pending'];
  const CLOSED_STATUSES = ['closed', 'rejected'];

  for (const t of tickets) {
    const status = (t.status || 'unknown').toLowerCase();
    const priority = (t.priority || 'medium').toLowerCase();
    const dept = t.department || 'Unassigned';

    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    priorityDistribution[priority] = (priorityDistribution[priority] || 0) + 1;
    departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + 1;

    const creatorKey = t.user_id;
    if (!topCreators[creatorKey]) {
      topCreators[creatorKey] = { count: 0, dept, title: t.title ? t.title.substring(0, 40) : '' };
    }
    topCreators[creatorKey].count += 1;

    if (status === 'closed' || CLOSED_STATUSES.includes(status)) {
      const created = new Date(t.created_at);
      const updated = new Date(t.updated_at);
      if (!isNaN(created) && !isNaN(updated)) {
        const diffHours = (updated - created) / (1000 * 60 * 60);
        totalResolutionTimeSum += diffHours;
        totalResolutionCount += 1;
      }
    }

    if (OPEN_STATUSES.includes(status) && t.due_date) {
      const due = new Date(t.due_date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) {
        overdueTickets.push({ ...t, overdueDays: Math.floor((today - due) / (1000 * 60 * 60 * 24)) });
      }
    }

    if (OPEN_STATUSES.includes(status)) {
      openTickets.push(t);
    }
  }

  if (totalResolutionCount > 0) {
    const avgHours = totalResolutionTimeSum / totalResolutionCount;
    const days = Math.floor(avgHours / 24);
    const hours = Math.round(avgHours % 24);
    topCreators.avgResolutionTime = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  }

  const fiscalMonths = [];
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1;
    const y = m >= 4 ? fiscalYearToUse : fiscalYearToUse + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    fiscalMonths.push({ key, month: m, year: y });
  }

  const monthlyTrendsMap = {};
  for (const t of tickets) {
    const d = new Date(t.created_at);
    if (isNaN(d.getTime())) continue;
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyTrendsMap[mk]) monthlyTrendsMap[mk] = { month: mk, Open: 0, Closed: 0, Rejected: 0, total: 0 };
    const s = String(t.status || '').toLowerCase();
    if (monthlyTrendsMap[mk][s] !== undefined) monthlyTrendsMap[mk][s] += 1;
    monthlyTrendsMap[mk].total += 1;
  }
  const monthlyTrendsArray = fiscalMonths.map(fm => monthlyTrendsMap[fm.key] || { month: fm.key, Open: 0, Closed: 0, Rejected: 0, total: 0 });

  const assigneeCounts = {};
  for (const t of tickets) {
    const ids = Array.isArray(t.assigned_to_ids) ? t.assigned_to_ids : (t.assigned_to ? [t.assigned_to] : []);
    for (const aid of ids) {
      const key = String(aid);
      if (!assigneeCounts[key]) assigneeCounts[key] = { assigned_count: 0, overdue_count: 0, id: aid };
      assigneeCounts[key].assigned_count += 1;
      const s = String(t.status || '').toLowerCase();
      const isOpen = ['open', 'assigned', 'in progress', 'pending'].includes(s);
      const isOverdue = isOpen && t.due_date && new Date(t.due_date + 'T00:00:00') < new Date(new Date().toDateString());
      if (isOverdue) assigneeCounts[key].overdue_count += 1;
    }
  }

  const topCreatorsArray = Object.entries(topCreators)
    .filter(([key]) => key !== 'avgResolutionTime')
    .map(([id, data]) => ({ id: parseInt(id) || 0, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const overdueTable = overdueTickets.slice(0, 50).map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    department: t.department,
    due_date: t.due_date,
    overdue_days: t.overdueDays,
  }));

  const openAges = { '0-1 day': 0, '1-3 days': 0, '3-7 days': 0, '7+ days': 0 };
  for (const t of openTickets) {
    const created = new Date(t.created_at);
    const now = new Date();
    const ageDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    if (ageDays <= 1) openAges['0-1 day']++;
    else if (ageDays <= 3) openAges['1-3 days']++;
    else if (ageDays <= 7) openAges['3-7 days']++;
    else openAges['7+ days']++;
  }

  const avgResolutionHours = totalResolutionCount > 0 ? Math.round(totalResolutionTimeSum / totalResolutionCount) : 0;
  const avgResolutionDays = Math.floor(avgResolutionHours / 24);
  const avgResolutionRemainingHours = avgResolutionHours % 24;

  return {
    success: true,
    data: {
      summary: {
        total_tickets: tickets.length,
        open_tickets: statusDistribution['open'] || 0,
        closed_tickets: (statusDistribution['closed'] || 0) + (statusDistribution['rejected'] || 0),
        overdue_tickets: overdueTickets.length,
        avg_resolution_hours: avgResolutionHours,
        avg_resolution_display: avgResolutionDays > 0 ? `${avgResolutionDays}d ${avgResolutionRemainingHours}h remaining` : `${avgResolutionRemainingHours}h remaining`,
      },
      status_distribution: statusDistribution,
      priority_distribution: priorityDistribution,
      department_breakdown: departmentBreakdown,
      top_creators: topCreatorsArray,
      assignee_breakdown: Object.values(assigneeCounts),
      overdue_table: overdueTable,
      monthly_trends: monthlyTrendsArray,
      open_aging: openAges,
    },
  };
};

// Create a ticket in the tickets table
exports.createTicket = async (data, db = pool) => {
  const query = `
    INSERT INTO tickets (title, description, priority, status, user_id, due_date, attachment, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `;
  const values = [
    data.title,
    data.description || '',
    data.priority || 'Medium',
    data.status || 'Open',
    data.user_id,
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
              OR EXISTS (
                SELECT 1
                FROM ticket_assignees ta
                WHERE ta.ticket_id = tickets.id AND ta.assigned_to = $1
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
          OR EXISTS (
            SELECT 1
            FROM ticket_assignees ta
            WHERE ta.ticket_id = t.id AND ta.assigned_to = $1
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
            OR EXISTS (
              SELECT 1
              FROM ticket_assignees ta
              WHERE ta.ticket_id = tickets.id AND ta.assigned_to = $1
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
        OR EXISTS (
          SELECT 1
          FROM ticket_assignees ta
          WHERE ta.ticket_id = tickets.id AND ta.assigned_to = $1
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
        OR EXISTS (
          SELECT 1
          FROM ticket_assignees ta
          WHERE ta.ticket_id = tickets.id AND ta.assigned_to = $1
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
  if (data.due_date !== undefined) { fields.push(`due_date = $${idx++}`); values.push(data.due_date); }
  if (data.attachment !== undefined) { fields.push(`attachment = $${idx++}`); values.push(data.attachment); }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status); }

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
