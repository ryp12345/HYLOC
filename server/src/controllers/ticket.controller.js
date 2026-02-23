// Get tickets created by the logged-in user
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const tickets = await ticketModel.getTicketsByUserId(userId);
    res.status(200).json({ success: true, data: tickets });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user tickets', error: error.message });
  }
};
const ticketModel = require('../models/ticket.model');
const notificationModel = require('../models/notification.model');
const fs = require('fs');
const path = require('path');

const publicRoot = path.resolve(__dirname, '../../public');

const toLocalUploadPath = (attachmentPath) => {
  if (!attachmentPath || typeof attachmentPath !== 'string') return null;
  const normalized = attachmentPath.replace(/\\/g, '/');
  if (!normalized.startsWith('/uploads/')) return null;

  const relativePath = normalized.replace(/^\/+/, '');
  const absolutePath = path.resolve(publicRoot, relativePath);
  if (!absolutePath.startsWith(publicRoot)) return null;
  return absolutePath;
};

const removeLocalAttachmentIfExists = async (attachmentPath) => {
  const localPath = toLocalUploadPath(attachmentPath);
  if (!localPath) return;
  try {
    await fs.promises.unlink(localPath);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.error('Attachment cleanup error:', err);
    }
  }
};

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
          const tTitle = created.title || '';
          const tDesc = created.description || '';
          const message = `You were assigned a ticket. \nTitle: ${tTitle}\nDescription: ${tDesc}`;
          await notificationModel.createNotification({ created_by: requesterId, assigned_to: assigneeId, message, type: 'ticket' });
        }
      } catch (notifErr) {
        console.error('Create ticket notification error:', notifErr);
      }
    })();

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

    if (req.file && req.file.filename) {
      payload.attachment = `/uploads/tickets/${req.file.filename}`;
    } else if (payload.attachment === '') {
      payload.attachment = null;
    }

    // fetch existing ticket to enforce rules
    const existing = await ticketModel.getTicketById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;

    // Allowed status transitions map
    const allowedTransitions = {
      Open: ['Assigned', 'Rejected'],
      Rejected: ['Open'],
      Assigned: ['In Progress', 'Rejected'],
      'In Progress': ['Resolved'],
      Resolved: ['Closed'],
      Closed: [],
    };

    // If status is being changed, enforce allowed transitions
    if (payload.status && payload.status !== existing.status) {
      const from = String(existing.status || '').trim();
      const to = String(payload.status || '').trim();
      const allowed = (allowedTransitions[from] || []).map(s => String(s).trim());
      // Temporary debug log for status transitions
      console.debug('Status transition attempt:', { ticketId: id, requesterId, from, to, allowed });
      if (!allowed.includes(to)) {
        return res.status(400).json({ success: false, message: `Invalid status transition: ${from} → ${to}` });
      }
    }

    // Field-level edit permissions


    // Only Management or creator can edit due_date
    // (Manager role is NOT allowed unless also creator)
    const isManagement = requesterRole && requesterRole.toLowerCase() === 'management';
    const isCreator = String(existing.user_id) === String(requesterId);
    const isManager = requesterRole && requesterRole.toLowerCase() === 'manager';

    // Normalize date-only strings for robust comparison (DB may include time)
    const formatDateOnly = (val) => {
      if (val === undefined || val === null) return null;
      try {
        if (val instanceof Date) return val.toISOString().slice(0, 10);
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      } catch (e) {
        // fallthrough
      }
      return String(val).slice(0, 10);
    };

    const payloadDueRaw = payload.due_date !== undefined ? payload.due_date : undefined;
    const payloadDue = payloadDueRaw !== undefined ? formatDateOnly(payloadDueRaw) : undefined;
    const existingDue = existing && existing.due_date !== undefined && existing.due_date !== null ? formatDateOnly(existing.due_date) : null;

    // Only enforce due_date permission when the date actually changes
    if (payloadDue !== undefined && payloadDue !== existingDue) {
      if (!isManagement && !isCreator) {
        // Explicitly block Manager role and all others
        return res.status(403).json({ success: false, message: 'Only Management or the ticket creator can edit due_date' });
      }
    }

    // Other users can only edit title and description
    const isAssignee = String(existing.assigned_to) === String(requesterId);
    if (!isManagement && !isCreator && !isAssignee) {
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
        
        // Special handling for 'Rejected' status: send custom format to creator
        if (payload.status === 'Rejected') {
          // Send custom format to creator
          const creatorMessage = `Type: Ticket rejected\nTitle: ${existing.title}\nDescription: ${existing.description || ''}`;
          await notificationModel.createNotification({ created_by: requesterId, assigned_to: existing.user_id, message: creatorMessage, type: 'ticket_status' });

          // Send standard format to managers
          /* for (const managerId of managerIds) {
            const managerMessage = `Ticket #${existing.id} ('${existing.title}') status changed to ${payload.status} by user #${requesterId}`;
            await notificationModel.createNotification({ created_by: requesterId, assigned_to: managerId, message: managerMessage, type: 'ticket_status' });
          } */

          // Treat 'Rejected' as a transient state for all cases:
          // - Revert status back to 'Open'
          // - Unassign the ticket so the creator can reassign
          try {
            payload.status = 'Open';
            payload.assigned_to = null;
          } catch (e) {
            console.error('Error handling transient Rejected state:', e);
          }
        } else if (payload.status === 'Resolved') {
          // When assignee resolves the ticket, notify the creator with a resolved notification
          const creatorMessage = `Type: Ticket resolved\nTitle: ${existing.title}\nDescription: ${existing.description || ''}`;
          await notificationModel.createNotification({ created_by: requesterId, assigned_to: existing.user_id, message: creatorMessage, type: 'ticket_status' });
        } else {
          // For other status changes, send standard format to all recipients (kept commented intentionally)
          /* const recipients = new Set([existing.user_id, ...managerIds]);
          for (const recipientId of recipients) {
            const message = `Ticket #${existing.id} ('${existing.title}') status changed to ${payload.status} by user #${requesterId}`;
            await notificationModel.createNotification({ created_by: requesterId, assigned_to: recipientId, message, type: 'ticket_status' });
          } */
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
      const changedFields = editableFields.filter(f => {
        if (payload[f] === undefined) return false;
        if (f === 'due_date') {
          const p = payload.due_date !== undefined ? (typeof formatDateOnly === 'function' ? formatDateOnly(payload.due_date) : (new Date(payload.due_date)).toISOString().slice(0,10)) : null;
          const e = existing && existing.due_date !== undefined && existing.due_date !== null ? (typeof formatDateOnly === 'function' ? formatDateOnly(existing.due_date) : (new Date(existing.due_date)).toISOString().slice(0,10)) : null;
          return p !== e;
        }
        return payload[f] !== existing[f];
      });
      /* if (changedFields.length > 0 && existing.assigned_to) {
        const message = `Ticket #${existing.id} ('${existing.title}') was updated (${changedFields.join(', ')}) by user #${requesterId}`;
        await notificationModel.createNotification({ created_by: requesterId, assigned_to: existing.assigned_to, message, type: 'ticket_edit' });
      } */
    }

    console.log('DEBUG: Updating ticket', { id, payload });
    const updated = await ticketModel.updateTicket(id, payload);
    console.log('DEBUG: Updated ticket result', updated);
    if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const replacedOrClearedAttachment = Boolean(req.file && req.file.filename) || payload.attachment === null;
    if (replacedOrClearedAttachment && existing.attachment && existing.attachment !== updated.attachment) {
      await removeLocalAttachmentIfExists(existing.attachment);
    }

    // If reassigned to a different user, create an in-app notification for the new assignee.
    try {
      const payloadAssigned = payload.assigned_to !== undefined && payload.assigned_to !== null ? String(payload.assigned_to) : null;
      const existingAssigned = existing && existing.assigned_to ? String(existing.assigned_to) : null;
      if (payloadAssigned && payloadAssigned !== existingAssigned) {
        const assigneeId = Number(payload.assigned_to);
        const tTitle = updated.title || '';
        const tDesc = updated.description || '';
        const message = `You were assigned a ticket.\nTitle: ${tTitle}\nDescription: ${tDesc}`;
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