const cron = require('node-cron');
const pool = require('../config/db');
const notificationModel = require('../models/notification.model');

// Find overdue tickets and send one-off notifications to assigned user and management/manager roles.
const findOverdueTickets = async () => {
  const query = `SELECT * FROM tickets WHERE due_date < CURRENT_DATE AND status != 'Closed'`;
  const result = await pool.query(query);
  return result.rows || [];
};

const findManagementUsers = async () => {
  const q = `
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.role_name IN ('Management','Manager') AND ur.status = 'active'
  `;
  const res = await pool.query(q);
  return res.rows.map(r => r.id);
};

const notificationExists = async (recipientId, ticketId) => {
  const likePattern = `%#${ticketId}%`;
  const q = `SELECT 1 FROM notifications WHERE assigned_to = $1 AND type = $2 AND message LIKE $3 LIMIT 1`;
  const r = await pool.query(q, [recipientId, 'ticket_overdue', likePattern]);
  return r.rowCount > 0;
};

const runOnce = async () => {
  const tickets = await findOverdueTickets();
  if (!tickets.length) return { sent: 0 };

  const managementUsers = await findManagementUsers();
  let sent = 0;

  for (const ticket of tickets) {
    const recipients = new Set();
    if (ticket.assigned_to) recipients.add(Number(ticket.assigned_to));
    managementUsers.forEach(id => recipients.add(Number(id)));

    for (const recipientId of recipients) {
      try {
        const exists = await notificationExists(recipientId, ticket.id);
        if (exists) continue;
        const message = `Ticket #${ticket.id} is overdue: ${ticket.title}`;
        await notificationModel.createNotification({ created_by: ticket.user_id, assigned_to: recipientId, message, type: 'ticket_overdue' });
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
  // daily at midnight
  const CRON = '0 0 * * *';
  cron.schedule(CRON, async () => {
    try {
      const res = await runOnce();
      console.log(`Overdue scheduler run complete. Notifications sent: ${res.sent}`);
    } catch (err) {
      console.error('Overdue scheduler error:', err);
    }
  });
  console.log('Overdue tickets scheduler started (daily at midnight)');
};

module.exports = { runOnce, startOverdueScheduler };
