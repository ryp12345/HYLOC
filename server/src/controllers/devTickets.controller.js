const db = require('../config/db');

// Get ticket counts by status for all tickets
const getTicketCounts = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'Open') AS new,
        COUNT(*) FILTER (WHERE status = 'Pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved,
        COUNT(*) AS total
      FROM dev_tickets`
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ticket counts' });
  }
};

// Create a new ticket
const createTicket = async (req, res) => {
  try {
    const { title, description, priority, attachment_url } = req.body;
    const created_by = req.user?.userId; // JWT token uses userId
    
    console.log('Creating ticket with data:', { title, description, priority, created_by });
    
    if (!title || !created_by) {
      return res.status(400).json({ error: 'Title and created_by are required' });
    }
    const result = await db.query(
      `INSERT INTO dev_tickets
        (title, description, created_by, priority, status, attachment_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        title,
        description || '',
        created_by,
        priority || 'Medium',
        'Open',
        attachment_url || null
      ]
    );
    console.log('Ticket created successfully:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating ticket:', err);
    res.status(500).json({ error: 'Failed to create ticket: ' + err.message });
  }
};

// Get all tickets
const getAllTickets = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM dev_tickets ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
};


// Update a ticket
const updateTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { title, description, status, priority } = req.body;

    // Fetch the ticket
    const ticketRes = await db.query('SELECT * FROM dev_tickets WHERE id = $1', [ticketId]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    // Only the creator can edit all fields, developer can only change status
    let updates = {};
    if (userId === ticket.created_by) {
      // Creator can edit all
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (priority !== undefined) updates.priority = priority;
    } else if (userRole && userRole.toLowerCase() === 'developer') {
      // Developer can only change status
      if (status !== undefined) updates.status = status;
    } else {
      return res.status(403).json({ error: 'Not authorized to update this ticket' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Build dynamic SQL
    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
    const values = Object.values(updates);
    values.push(ticketId);
    const updateSql = `UPDATE dev_tickets SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`;
    const result = await db.query(updateSql, values);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating ticket:', err);
    res.status(500).json({ error: 'Failed to update ticket: ' + err.message });
  }
};

module.exports = { getTicketCounts, createTicket, getAllTickets, updateTicket };


