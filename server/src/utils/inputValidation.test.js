const { getNameError, getEmailError, getPersonFieldsError } = require('./inputValidation');

describe('name and email validation', () => {
  test.each([
    'Rohit', 'Mary-Jane', "D'Souza", 'Patil Jr.', 'Ånström', 'राहुल', 'Anne (Annie)'
  ])('accepts the real name %s', (name) => {
    expect(getNameError(name)).toBeNull();
  });

  test.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg/onload=alert(1)>',
    'javascript:alert(1)',
    '=HYPERLINK("http://evil")',
    'Bob\u0000',
    'Line\nBreak',
    'x'.repeat(101)
  ])('rejects %s as a name', (name) => {
    expect(getNameError(name)).not.toBeNull();
  });

  test.each(['person@hyloc.co.in', 'first.last+tag@example.com'])('accepts the email %s', (email) => {
    expect(getEmailError(email)).toBeNull();
  });

  test.each([
    '<script>@x.com',
    'a@b.c<img src=x onerror=alert(1)>',
    '"><svg/onload=alert(1)>@x.com',
    'victim@x.com, attacker@y.com',
    'no-at-sign',
    'spaces in@x.com'
  ])('rejects %s as an email', (email) => {
    expect(getEmailError(email)).not.toBeNull();
  });

  test('empty optional fields are allowed (required checks are separate)', () => {
    expect(getPersonFieldsError({ firstName: 'A', lastName: 'B', middleName: '', email: 'a@b.co' })).toBeNull();
  });
});
