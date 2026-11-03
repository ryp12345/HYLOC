jest.mock('../models/ticket.model', () => ({
  getTicketById: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn(),
  createTicket: jest.fn()
}));
jest.mock('../models/notification.model', () => ({
  createNotification: jest.fn()
}));
jest.mock('../config/db', () => ({
  connect: jest.fn(),
  query: jest.fn()
}));

const ticketModel = require('../models/ticket.model');
const pool = require('../config/db');
const fs = require('fs');
const controller = require('./ticket.controller');

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return response;
};

describe('updateTicket authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects users who are neither the creator, an assignee, nor Management', async () => {
    ticketModel.getTicketById.mockResolvedValue({
      id: 12,
      user_id: 10,
      assigned_to_ids: [20],
      status: 'Open'
    });
    const response = createResponse();

    await controller.updateTicket({
      params: { id: 12 },
      user: { userId: 30, role: 'Employee' },
      body: { title: 'Changed', assigned_to_ids: [30] }
    }, response);

    expect(response.statusCode).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(ticketModel.updateTicket).not.toHaveBeenCalled();
  });

  test('does not allow an assignee to reassign the ticket', async () => {
    ticketModel.getTicketById.mockResolvedValue({
      id: 12,
      user_id: 10,
      assigned_to_ids: [20],
      status: 'Open'
    });
    const response = createResponse();

    await controller.updateTicket({
      params: { id: 12 },
      user: { userId: 20, role: 'Employee' },
      body: { title: 'Changed', assigned_to_ids: [30] }
    }, response);

    expect(response.statusCode).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(ticketModel.updateTicket).not.toHaveBeenCalled();
  });

  test('does not allow a creator to change ticket ownership', async () => {
    const existing = {
      id: 12,
      user_id: 10,
      assigned_to_ids: [20],
      status: 'Open',
      title: 'Original',
      description: 'Details',
      attachment: null
    };
    const updated = { ...existing, title: 'Changed' };
    ticketModel.getTicketById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    ticketModel.updateTicket.mockResolvedValue(updated);
    pool.query.mockResolvedValue({ rows: [] });
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    const response = createResponse();

    await controller.updateTicket({
      params: { id: 12 },
      user: { userId: 10, role: 'Employee' },
      body: { title: 'Changed', user_id: 30, assigned_to_ids: [20] }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(ticketModel.updateTicket.mock.calls[0][1]).not.toHaveProperty('user_id');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe('deleteTicket authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ticketModel.getTicketById.mockResolvedValue({
      id: 12,
      user_id: 10,
      status: 'Closed'
    });
    ticketModel.deleteTicket.mockResolvedValue({ id: 12 });
  });

  test('denies a non-creator who is not Management', async () => {
    const response = createResponse();

    await controller.deleteTicket({
      params: { id: '12' },
      user: { userId: 20, role: 'Employee' }
    }, response);

    expect(response.statusCode).toBe(403);
    expect(ticketModel.deleteTicket).not.toHaveBeenCalled();
  });

  test('allows the ticket creator to delete a closed ticket', async () => {
    const response = createResponse();

    await controller.deleteTicket({
      params: { id: '12' },
      user: { userId: 10, role: 'Employee' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(ticketModel.deleteTicket).toHaveBeenCalledWith('12');
  });

  test('allows Management to delete a closed ticket', async () => {
    const response = createResponse();

    await controller.deleteTicket({
      params: { id: '12' },
      user: { userId: 20, role: 'Management' }
    }, response);

    expect(response.statusCode).toBe(200);
    expect(ticketModel.deleteTicket).toHaveBeenCalledWith('12');
  });
});

describe('getTicketAttachment authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('denies a user who cannot view the ticket', async () => {
    ticketModel.getTicketById.mockResolvedValue({
      id: 12,
      user_id: 10,
      assigned_to_ids: [],
      attachment: '/uploads/tickets/secret.pdf'
    });
    const response = createResponse();
    response.download = jest.fn();

    await controller.getTicketAttachment({
      params: { id: '12' },
      user: { userId: 20, role: 'Employee' }
    }, response);

    expect(response.statusCode).toBe(403);
    expect(response.download).not.toHaveBeenCalled();
  });

  test('serves an attachment to the ticket creator', async () => {
    ticketModel.getTicketById.mockResolvedValue({
      id: 12,
      user_id: 10,
      assigned_to_ids: [],
      attachment: '/uploads/tickets/randomized.pdf'
    });
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const response = createResponse();
    response.download = jest.fn();
    response.setHeader = jest.fn();

    await controller.getTicketAttachment({
      params: { id: '12' },
      user: { userId: 10, role: 'Employee' }
    }, response);

    expect(response.download).toHaveBeenCalledWith(expect.stringContaining('randomized.pdf'));
  });
});

// Security regression tests for audit finding M1: the attachment path must never
// come from the client, and file deletion must stay inside uploads/tickets.
describe('ticket attachment paths cannot be chosen by the client', () => {
  const path = require('path');
  const ticketsDir = path.resolve(__dirname, '../../public/uploads/tickets');
  let unlinkSpy;
  let client;

  const openTicket = (overrides = {}) => ({
    id: 12, user_id: 10, assigned_to_ids: [20], status: 'Open',
    title: 'T', description: 'D', attachment: null, ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValue();
    client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    pool.query.mockResolvedValue({ rows: [] });
    ticketModel.updateTicket.mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const update = async (body, existing) => {
    // 1st lookup: the ticket before the update; later lookups: the ticket as saved
    const saved = { ...existing, attachment: body.attachment === '' ? null : existing.attachment };
    ticketModel.getTicketById.mockResolvedValueOnce(existing).mockResolvedValue(saved);
    const response = createResponse();
    await controller.updateTicket({ params: { id: 12 }, user: { userId: 10, role: 'Employee' }, body }, response);
    return response;
  };

  test('create ignores an attachment path sent as text', async () => {
    ticketModel.createTicket.mockResolvedValue({ id: 99 });
    ticketModel.getTicketById.mockResolvedValue({ id: 99 });
    const response = createResponse();

    await controller.createTicket({
      user: { userId: 10, role: 'Employee' },
      body: { title: 'T', due_date: '2026-12-01', assigned_to_ids: [20], attachment: '/uploads/users/70001.JPG' }
    }, response);

    expect(response.statusCode).toBe(201);
    expect(ticketModel.createTicket.mock.calls[0][0].attachment).toBeNull();
  });

  test('update ignores an attachment path sent as text', async () => {
    const response = await update({ attachment: '/uploads/users/70001.JPG' }, openTicket());

    expect(response.statusCode).toBe(200);
    expect(ticketModel.updateTicket.mock.calls[0][1]).not.toHaveProperty('attachment');
  });

  test('clearing an attachment never deletes files outside uploads/tickets', async () => {
    // A value planted before the fix, pointing at another user's staff photo
    await update({ attachment: '' }, openTicket({ attachment: '/uploads/users/70001.JPG' }));

    const deleted = unlinkSpy.mock.calls.map(([file]) => file);
    expect(unlinkSpy).toHaveBeenCalledWith(path.join(ticketsDir, '70001.JPG'));
    expect(deleted.every((file) => file.startsWith(ticketsDir + path.sep))).toBe(true);
    expect(deleted.some((file) => file.includes(`${path.sep}users${path.sep}`))).toBe(false);
  });

  test('path traversal in a stored value stays inside uploads/tickets', async () => {
    await update({ attachment: '' }, openTicket({ attachment: '/api/uploads/tickets/../../../src/app.js' }));

    expect(unlinkSpy).toHaveBeenCalledWith(path.join(ticketsDir, 'app.js'));
  });

  test('clearing a real attachment still deletes its file', async () => {
    const response = await update({ attachment: '' }, openTicket({ attachment: '/api/uploads/tickets/abc123.pdf' }));

    expect(response.statusCode).toBe(200);
    expect(ticketModel.updateTicket.mock.calls[0][1].attachment).toBeNull();
    expect(unlinkSpy).toHaveBeenCalledWith(path.join(ticketsDir, 'abc123.pdf'));
  });

  test('sending the existing path back unchanged keeps the attachment', async () => {
    await update({ title: 'New', attachment: '/api/uploads/tickets/abc123.pdf' },
      openTicket({ attachment: '/api/uploads/tickets/abc123.pdf' }));

    expect(ticketModel.updateTicket.mock.calls[0][1]).not.toHaveProperty('attachment');
    expect(unlinkSpy).not.toHaveBeenCalled();
  });

  test('deleting a ticket removes its attachment file', async () => {
    ticketModel.getTicketById.mockResolvedValue(openTicket({ status: 'Closed', attachment: '/api/uploads/tickets/abc123.pdf' }));
    ticketModel.deleteTicket.mockResolvedValue({ id: 12 });
    const response = createResponse();

    await controller.deleteTicket({ params: { id: '12' }, user: { userId: 10, role: 'Employee' } }, response);

    expect(response.statusCode).toBe(200);
    expect(unlinkSpy).toHaveBeenCalledWith(path.join(ticketsDir, 'abc123.pdf'));
  });
});
