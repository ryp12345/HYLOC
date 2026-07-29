import React from 'react';

export default function Notification({ show, message, type = 'success', onClose }) {
  if (!show) return null;

  let msgStr = typeof message === 'string' ? message : String(message || '');
  // Normalize if Title/Description appear on same line
  msgStr = msgStr.replace(/\s+Title:/i, '\nTitle:').replace(/\s+Description:/i, '\nDescription:');
  const lines = msgStr.split('\n').map(l => l.trim()).filter(Boolean);
  const initialLineRaw = lines.find(l => /you were assigned/i.test(l)) || lines[0] || '';
  const initialSentence = (() => {
    if (!initialLineRaw) return '';
    const idx = initialLineRaw.indexOf('.');
    if (idx !== -1) return initialLineRaw.slice(0, idx + 1).trim();
    return initialLineRaw;
  })();
  const titleLine = lines.find(l => l.toLowerCase().startsWith('title:'));
  const descLine = lines.find(l => l.toLowerCase().startsWith('description:'));
  const title = titleLine ? titleLine.split(':').slice(1).join(':').trim() : (lines[1] || '');
  const desc = descLine ? descLine.split(':').slice(1).join(':').trim() : (lines.filter(l => l !== titleLine && l !== initialLineRaw)[1] || lines.slice(2).join(' '));

  return (
    <div className="fixed top-6 right-4 md:right-6 z-50 w-auto max-w-sm">
      <div className={`w-full px-4 py-3 rounded-lg border flex items-center justify-between shadow-lg ${type === 'success' ? 'border-[color:var(--success)] bg-[color:var(--success-soft)] text-[color:var(--text-primary)]' : type === 'error' ? 'border-[color:var(--danger)] bg-[color:var(--danger-soft)] text-[color:var(--text-primary)]' : 'border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-primary)]'}`}>
        <div className="flex items-center gap-3">
          <span className="notification-icon text-lg">{type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ️'}</span>
          <div className="notification-message ml-1 font-medium">
            {initialSentence ? <div className="text-sm text-[color:var(--text-primary)]">{initialSentence}</div> : null}
            <div className="notification-title truncate max-w-xs">{title ? `Title: ${title}` : ''}</div>
            {desc ? (
              <div className="notification-desc text-sm font-normal mt-1 truncate max-w-xs">{`Description: ${desc}`}</div>
            ) : null}
          </div>
        </div>
        <button className="notification-close text-lg font-bold ml-3" onClick={onClose} aria-label="Close notification">×</button>
      </div>
    </div>
  );
}
