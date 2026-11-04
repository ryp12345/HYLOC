// Checks for identity fields people type (names, email). React escapes these when
// shown, but they also end up in emails, notifications, exports and other systems,
// so markup and control characters are refused at the source.

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

// Letters, marks, spaces and common name punctuation; no < > or other markup characters
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’()-]*$/u;
// Practical email check: one @, no spaces, quotes or markup, a dot in the domain
const EMAIL_PATTERN = /^[^\s@<>"'`(),;:\\[\]]+@[^\s@<>"'`(),;:\\[\]]+\.[^\s@<>"'`(),;:\\[\]]{2,}$/;

// Returns an error message, or null when the value is acceptable.
// Empty values are allowed here; "required" checks stay in the controllers.
const getNameError = (value, label = 'Name') => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return `${label} must be text.`;
  const trimmed = value.trim();
  if (trimmed.length > MAX_NAME_LENGTH) return `${label} must be at most ${MAX_NAME_LENGTH} characters.`;
  if (!NAME_PATTERN.test(trimmed)) {
    return `${label} may contain only letters, spaces and . ' - ( ).`;
  }
  return null;
};

const getEmailError = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return 'Email must be text.';
  const trimmed = value.trim();
  if (trimmed.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return null;
};

// First error among the given person fields, or null
const getPersonFieldsError = ({ firstName, middleName, lastName, email }) => (
  getNameError(firstName, 'First name') ||
  getNameError(middleName, 'Middle name') ||
  getNameError(lastName, 'Last name') ||
  getEmailError(email)
);

module.exports = { getNameError, getEmailError, getPersonFieldsError };
