const { escapeHtml } = require('./escapeHtml');

describe('escapeHtml', () => {
  test('encodes every HTML-significant character', () => {
    expect(escapeHtml('<script>alert("x")</script>&\'`'))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;&#96;');
  });

  test('attribute break-out attempts become plain text', () => {
    expect(escapeHtml('" onmouseover="alert(1)')).toBe('&quot; onmouseover=&quot;alert(1)');
  });

  test('handles null, undefined and numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  test('normal text is unchanged', () => {
    expect(escapeHtml('rohit.patil@hyloc.co.in')).toBe('rohit.patil@hyloc.co.in');
  });
});
