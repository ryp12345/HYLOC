import React, { useState } from 'react';

// Shows a newly generated temporary password exactly once.
// The value lives only in the parent's state and is cleared when this closes;
// it is never stored, so it cannot be shown again later.
const TemporaryPasswordDialog = ({ password, userName, reason = 'reset', onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  if (!password) return null;

  // Older copy method. Needed when the app is opened over plain http on a
  // network address (e.g. http://192.168.x.x), where browsers disable navigator.clipboard.
  const legacyCopy = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
    return ok;
  };

  const copy = async () => {
    setCopyError('');
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(password);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      try {
        ok = legacyCopy(password);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyError('Copy failed. Please select the password and copy it manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="temp-password-title">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
          <div className="bg-[color:var(--accent)] px-6 py-4">
            <h3 id="temp-password-title" className="text-lg font-medium text-white">
              {reason === 'create' ? 'Account created' : 'Password reset'}
              {userName ? ` — ${userName}` : ''}
            </h3>
          </div>
          <div className="space-y-4 px-6 py-5 text-sm text-[color:var(--text-secondary)]">
            <p>
              Temporary password for{' '}
              <span className="font-semibold text-[color:var(--text-primary)]">{userName || 'this user'}</span>:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all rounded border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-3 py-2 font-mono text-base tracking-wider text-[color:var(--text-primary)]">
                {password}
              </code>
              <button
                type="button"
                onClick={copy}
                className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {copyError && <p className="text-[color:var(--danger)]">{copyError}</p>}
            {/* Theme colour variables, so the note is readable in both light and dark mode */}
            <div className="rounded border border-[color:var(--warning)] bg-[color:var(--warning-soft)] p-3 text-[color:var(--text-primary)]">
              <p className="font-semibold">⚠️ This password is shown only once.</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Give it to the employee privately — in person or by phone. Do not post it in group chats or shared email.</li>
                <li>The employee must choose a new password the first time they log in.</li>
                <li>If it is lost, reset the password again to get a new one.</li>
              </ul>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-2 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]"
              >
                I have saved it — close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemporaryPasswordDialog;
