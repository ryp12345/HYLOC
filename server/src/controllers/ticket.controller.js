const ticketModel = require('../models/ticket.model');

exports.getTicketCategories = async (req, res) => {
  try {
    const categories = await ticketModel.getTicketCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
  }
};

exports.getTicketPriorities = async (req, res) => {
  try {
    const priorities = await ticketModel.getTicketPriorities();
    res.status(200).json({ success: true, data: priorities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch priorities', error: error.message });
  }
};

exports.getTicketStatuses = async (req, res) => {
  try {
    const statuses = await ticketModel.getTicketStatuses();
    res.status(200).json({ success: true, data: statuses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch statuses', error: error.message });
  }
};

exports.createTicket = async (req, res) => {
  try {
    // For multipart/form-data, fields come in req.body and file in req.file
    const { title, description, category, priority, status, assigned_to, due_date } = req.body;
    const user_id = req.user?.userId;

    if (!title || !user_id || !due_date) {
      return res.status(400).json({ success: false, message: 'Title, user_id (creator) and due_date are required' });
    }

    // If a file was uploaded, build a URL path for it
    let attachmentUrl = null;
    if (req.file && req.file.filename) {
      // Serve from /uploads/tickets/<filename>
      attachmentUrl = `/uploads/tickets/${req.file.filename}`;
    } else if (req.body.attachment) {
      // fallback when client posted a string
      attachmentUrl = req.body.attachment;
    }

    const ticketData = {
      title,
      description: description || '',
      category: category || null,
      priority: priority || null,
      status: status || null,
      user_id,
      assigned_to: assigned_to ? Number(assigned_to) : null,
      due_date,
      attachment: attachmentUrl || null,
    };

    // If the creator assigns the ticket on create, force status to 'Assigned'
    if (ticketData.assigned_to && ticketData.user_id && String(ticketData.user_id) === String(req.user.userId)) {
      ticketData.status = 'Assigned';
    }

    const created = await ticketModel.createTicket(ticketData);
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create ticket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create ticket', error: error.message });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await ticketModel.getAllTickets();
    res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets', error: error.message });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await ticketModel.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    console.error('Get ticket by id error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch ticket', error: error.message });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const id = req.params.id;
    const payload = { ...req.body };

    // fetch existing ticket to enforce rules
    const existing = await ticketModel.getTicketById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const requesterId = req.user?.userId;

    // If trying to set status to Closed, only allow the creator
    if (payload.status && String(payload.status) === 'Closed') {
      if (String(existing.user_id) !== String(requesterId)) {
        return res.status(403).json({ success: false, message: 'Only the ticket creator can set status to Closed' });
      }
    }

    // If the creator assigns the ticket, force status to 'Assigned'
    if (payload.assigned_to !== undefined && payload.assigned_to !== null && String(existing.user_id) === String(requesterId)) {
      payload.status = 'Assigned';
    }

    const updated = await ticketModel.updateTicket(id, payload);
    if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket', error: error.message });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await ticketModel.deleteTicket(id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete ticket', error: error.message });
  }
};
