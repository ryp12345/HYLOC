const ticketModel = require('../models/ticket.model');
const notificationModel = require('../models/notification.model');

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

    // Create in-app notification for assignee (if any). Fail silently on error.
    (async () => {
      try {
        const requesterId = user_id;
        const assigneeId = created.assigned_to;
        if (assigneeId) {
          const message = `You have been professionally assigned a new ticket.\nTitle: ${created.title}\nDescription: ${created.description}`;
          await notificationModel.createNotification({ created_by: requesterId, assigned_to: assigneeId, message, type: 'ticket' });
        }
      } catch (notifErr) {
        console.error('Create ticket notification error:', notifErr);
      }
    })();
    ///////////////////Notification Code Added///////////////////

    // Only return title and description in response
    return res.status(201).json({
      success: true,
      data: {
        title: created.title,
        description: created.description
      },
      message: 'Ticket created successfully. Only title and description are shown for privacy.'
    });
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
      // Allowed status transitions map
      const allowedTransitions = {
        Open: ['Assigned', 'Rejected'],
        Rejected: ['Open'],
        Assigned: ['In Progress'],
        'In Progress': ['Resolved'],
        Resolved: ['Closed'],
        Closed: [],
      };

      // If status is being changed, enforce allowed transitions
      if (payload.status && payload.status !== existing.status) {
        const from = existing.status;
        const to = payload.status;
        const allowed = allowedTransitions[from] || [];
        if (!allowed.includes(to)) {
          return res.status(400).json({ success: false, message: `Invalid status transition: ${from} → ${to}` });
        }
      }
  try {
    const id = req.params.id;
    const payload = { ...req.body };

    // fetch existing ticket to enforce rules
    const existing = await ticketModel.getTicketById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;

    // Field-level edit permissions


    // Only Management or creator can edit due_date
    // (Manager role is NOT allowed unless also creator)
    const isManagement = requesterRole && requesterRole.toLowerCase() === 'management';
    const isCreator = String(existing.user_id) === String(requesterId);
    const isManager = requesterRole && requesterRole.toLowerCase() === 'manager';
    if (payload.due_date !== undefined) {
      if (!isManagement && !isCreator) {
        // Explicitly block Manager role and all others
        return res.status(403).json({ success: false, message: 'Only Management or the ticket creator can edit due_date' });
      }
    }

    // Other users can only edit title and description
    if (!isManagement && !isCreator) {
      // Remove any fields except title/description
      Object.keys(payload).forEach((key) => {
        if (!['title', 'description'].includes(key)) {
          delete payload[key];
        }
      });
      // If nothing left to update, reject
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, message: 'You can only edit title or description' });
      }
    }

    // If trying to set status to one of the assignee-only states, only allow the assigned user
    if (payload.status && ['In Progress', 'Rejected', 'Resolved'].includes(String(payload.status))) {
      if (String(existing.assigned_to) !== String(requesterId)) {
        return res.status(403).json({ success: false, message: 'Only the assigned user can set status to In Progress / Rejected / Resolved' });
      }
    }

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


    // On any status change, notify creator and all Managers (no assignee notification)
    let sentStatusNotification = false;
    if (payload.status && payload.status !== existing.status) {
      try {
        const pool = require('../config/db');
        // Find all users with Manager role
        const mgrRes = await pool.query(`
          SELECT u.id FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON ur.role_id = r.id
          WHERE r.role_name = 'Manager' AND ur.status = 'active'
        `);
        const managerIds = mgrRes.rows.map(r => r.id).filter(id => id !== existing.user_id);
        const recipients = new Set([existing.user_id, ...managerIds]);
        for (const recipientId of recipients) {
          const message = `Ticket #${existing.id} ('${existing.title}') status changed to ${payload.status} by user #${requesterId}`;
          await notificationModel.createNotification({ created_by: requesterId, assigned_to: recipientId, message, type: 'ticket_status' });
        }
        sentStatusNotification = true;
      } catch (notifErr) {
        console.error('Status-change notification error:', notifErr);
      }
    }

    // If not a status change, but other fields were edited, notify the assignee (if any)
    if (!sentStatusNotification) {
      // Check if any editable field other than status was changed
      const editableFields = ['title', 'description', 'category', 'priority', 'due_date', 'attachment'];
      const changedFields = editableFields.filter(f => payload[f] !== undefined && payload[f] !== existing[f]);
      if (changedFields.length > 0 && existing.assigned_to) {
        const message = `Ticket #${existing.id} ('${existing.title}') was updated (${changedFields.join(', ')}) by user #${requesterId}`;
        await notificationModel.createNotification({ created_by: requesterId, assigned_to: existing.assigned_to, message, type: 'ticket_edit' });
      }
    }

    const updated = await ticketModel.updateTicket(id, payload);
    if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // If reassigned to a different user, create an in-app notification for the new assignee.
    try {
      const payloadAssigned = payload.assigned_to !== undefined && payload.assigned_to !== null ? String(payload.assigned_to) : null;
      const existingAssigned = existing && existing.assigned_to ? String(existing.assigned_to) : null;
      if (payloadAssigned && payloadAssigned !== existingAssigned) {
        const assigneeId = Number(payload.assigned_to);
        const message = `You were assigned ticket #${updated.id}: ${updated.title}`;
        await notificationModel.createNotification({ created_by: requesterId, assigned_to: assigneeId, message, type: 'ticket' });
      }
    } catch (notifErr) {
      console.error('Update ticket notification error:', notifErr);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to update ticket', error: error.message });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const id = req.params.id;
    // Fetch the ticket first
    const ticket = await ticketModel.getTicketById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    if (ticket.status !== 'Closed') {
      return res.status(403).json({ success: false, message: 'Only tickets with status "Closed" can be deleted' });
    }
    const deleted = await ticketModel.deleteTicket(id);
    res.status(200).json({ success: true, data: deleted });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete ticket', error: error.message });
  }
};
