const cron = require('node-cron');
const pool = require('../config/db');
const notificationModel = require('../models/notification.model');

// Find overdue tickets and send one-off notifications to assigned users and management.
// Rejected and Closed tickets are finished, so they are never overdue.
const findOverdueTickets = async () => {
  const query = `SELECT * FROM tickets WHERE due_date < CURRENT_DATE AND status NOT IN ('Closed', 'Rejected')`;
  const result = await pool.query(query);
  return result.rows || [];
};

const findManagementUsers = async () => {
  const q = `
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.role_name = 'Management' AND ur.status = 'active'
  `;
  const res = await pool.query(q);
  return res.rows.map(r => r.id);
};

const findTicketAssignees = async (ticketId) => {
  const res = await pool.query('SELECT assigned_to FROM ticket_assignees WHERE ticket_id = $1', [ticketId]);
  return res.rows.map(r => r.assigned_to);
};

// Check for existing notification by type 'ticket_overdue:<ticketId>'
const notificationExists = async (recipientId, ticketId) => {
  const type = `ticket_overdue:${ticketId}`;
  const q = `SELECT 1 FROM notifications WHERE assigned_to = $1 AND type = $2 LIMIT 1`;
  const r = await pool.query(q, [recipientId, type]);
  return r.rowCount > 0;
};

const runOnce = async () => {
  const tickets = await findOverdueTickets();
  if (!tickets.length) return { sent: 0 };

  const managementUsers = await findManagementUsers();
  let sent = 0;

  for (const ticket of tickets) {
    const assignees = await findTicketAssignees(ticket.id);
    const recipients = Array.from(new Set([...assignees, ...managementUsers]));
    for (const recipientId of recipients) {
      try {
        const exists = await notificationExists(recipientId, ticket.id);
        if (exists) continue;
        const message = `Ticket overdue\nTitle: ${ticket.title}\nDescription: ${ticket.description || ''}`;
        await notificationModel.createNotification({ created_by: ticket.user_id, assigned_to: recipientId, message, type: `ticket_overdue:${ticket.id}` });
        sent += 1;
        console.log(`Overdue notification created for ticket ${ticket.id} -> user ${recipientId}`);
      } catch (err) {
        console.error('Failed to create overdue notification for ticket', ticket.id, 'user', recipientId, err);
      }
    }
  }

  return { sent };
};

const startOverdueScheduler = () => {
  // Daily at 09:00 server time (mins hrs dd mm weekday).
  // Each recipient gets at most one overdue notification per ticket (see notificationExists).
  const CRON = '0 9 * * *';
  cron.schedule(CRON, async () => {
    try {
      const res = await runOnce();
      console.log(`Overdue scheduler run complete. Notifications sent: ${res.sent}`);
    } catch (err) {
      console.error('Overdue scheduler error:', err);
    }
  });
  console.log('Overdue tickets scheduler started (daily at 09:00)');
};

module.exports = { runOnce, startOverdueScheduler };
