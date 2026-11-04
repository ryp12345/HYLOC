// The password-reset email is HTML: values from the account must be encoded.
jest.mock('nodemailer', () => {
  const sendMail = jest.fn(async () => ({}));
  return { createTransport: jest.fn(() => ({ sendMail })), __sendMail: sendMail };
});
jest.mock('../models/user.model', () => ({ findUserByEmail: jest.fn() }));
jest.mock('../models/passwordReset.model', () => ({ createRequest: jest.fn() }));

const nodemailer = require('nodemailer');
const UserModel = require('../models/user.model');
const controller = require('./auth.controller');

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

describe('password reset email', () => {
  test('the stored email is HTML-encoded and the mail goes to the address on record', async () => {
    const stored = 'a"><img src=x onerror=alert(1)>@x.com';
    UserModel.findUserByEmail.mockResolvedValue({ id: 3, email: stored });

    await controller.requestPasswordReset({ body: { email: stored } }, response());

    const mail = nodemailer.__sendMail.mock.calls[0][0];
    expect(mail.to).toBe(stored);
    expect(mail.html).not.toContain('<img src=x');
    expect(mail.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(mail.html).toMatch(/<span style="font-size:28px[^>]*>\d{6}<\/span>/);
  });
});
