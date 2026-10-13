// Older notifications were stored with this fixed first line; it carries no information.
const LEGACY_PREFIX = /^\s*You have a notification\s*\n?/i;

// Split a notification message into display lines, dropping the legacy prefix
export const getNotificationLines = (message) => {
  const normalized = String(message || '')
    .replace(LEGACY_PREFIX, '')
    .replace(/\s+Title:/i, '\nTitle:')
    .replace(/\s+Description:/i, '\nDescription:');
  return normalized.split('\n').map(l => l.trim()).filter(Boolean);
};

// Friendly label for a notification's type
export const getNotificationTypeLabel = (notif) => {
  const t = String(notif.type || '').toLowerCase();
  const msg = String(notif.message || '');
  if (/^ticket_overdue(:|$)/.test(t)) return 'Ticket overdue';
  if (t === 'ticket_status') {
    if (/rejected/i.test(msg)) return 'Ticket rejected';
    return 'Ticket status changed';
  }
  if (t === 'ticket') {
    if (/you were assigned/i.test(msg)) return 'Ticket assigned';
    return 'Ticket created';
  }
  if (t === 'ticket_edit') return 'Ticket updated';
  if (t === 'leave') return 'Leave';
  if (t === 'greeting') return 'Welcome';
  if (t === 'role-assignment') return 'Role assigned';
  return 'General';
};
