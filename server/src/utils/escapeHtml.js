// Encode text for safe use inside HTML (element content or quoted attributes).
// Use for every value placed into a server-built HTML string, such as emails.
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;'
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch]);

module.exports = { escapeHtml };
