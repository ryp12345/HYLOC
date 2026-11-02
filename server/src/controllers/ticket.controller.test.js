jest.mock('../models/ticket.model', () => ({
  getTicketById: jest.fn(),
  updateTicket: jest.fn(),
  deleteTicket: jest.fn()
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
