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
    WHERE r.role_name = 'Management' AND ur.status = 'active'
  `;
  const res = await pool.query(q);
  return res.rows.map(r => r.id);
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
    for (const recipientId of managementUsers) {
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
  //const CRON_EXPRESSION = '45 18 31 1 *'; // Jan 31st at 6:45 PM(mins hrs dd mm yyyy)
  //const CRON_EXPRESSION = '48 14 13 2 *'; // Feb 4th at 12:01PM
  //daily((mins hrs dd mm yyyy))
  const CRON = '50 14 17 2 *';
  cron.schedule(CRON, async () => {
    try {
      const res = await runOnce();
      console.log(`Overdue scheduler run complete. Notifications sent: ${res.sent}`);
    } catch (err) {
      console.error('Overdue scheduler error:', err);
    }
  });
  console.log('Overdue tickets scheduler started (custom cron)');
};

module.exports = { runOnce, startOverdueScheduler };
