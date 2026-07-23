// Get tickets visible to the logged-in user:
// - Management: all tickets
// - Employee / HOD: tickets they created OR are assigned to
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const tickets = await ticketModel.getTicketsByUserId(userId);
    // Attach rejected_date for rejected tickets (use updated_at)
    const enriched = (tickets || []).map(t => ({ ...(t || {}), ...(String(t?.status || '').toLowerCase() === 'rejected' ? { rejected_date: t.updated_at } : {}) }));
    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get my tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user tickets', error: error.message });
  }
};
const ticketModel = require('../models/ticket.model');
const notificationModel = require('../models/notification.model');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const normalizeIdList = (values) => {
  const list = Array.isArray(values)
    ? values
    : values === undefined || values === null || values === ''
      ? []
      : [values];

  return [...new Set(list.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
};

const extractAssigneeIds = (...sources) => {
  const combined = [];

  for (const source of sources) {
    if (Array.isArray(source)) {
      combined.push(...source);
      continue;
    }

    if (source === undefined || source === null) {
      continue;
    }

    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            combined.push(...parsed);
            continue;
          }
        } catch (error) {
          // Fall back to comma-separated parsing below.
        }
      }

      if (trimmed.includes(',')) {
        combined.push(...trimmed.split(','));
      } else {
        combined.push(trimmed);
      }
      continue;
    }

    combined.push(source);
  }

  return normalizeIdList(combined);
};

const getTicketAssigneeIds = (ticket) => extractAssigneeIds(ticket?.assigned_to_ids, ticket?.assigned_to);
const ticketHasAssignee = (ticket, userId) => getTicketAssigneeIds(ticket).includes(Number(userId));

const syncTicketAssignees = async (db, ticketId, assigneeIds, assignedBy) => {
  const normalizedAssigneeIds = extractAssigneeIds(assigneeIds);

  await db.query('DELETE FROM ticket_assignees WHERE ticket_id = $1', [ticketId]);

  for (const userId of normalizedAssigneeIds) {
    await db.query(
      `
        INSERT INTO ticket_assignees (ticket_id, assigned_to, assigned_by, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `,
      [ticketId, userId, assignedBy || null]
    );
  }

  return normalizedAssigneeIds;
};

const isManagementRole = (role) => String(role || '').toLowerCase() === 'management';

const publicRoot = path.resolve(__dirname, '../../public');
const ticketUploadsBasePath = '/api/uploads/tickets';

const toLocalUploadPath = (attachmentPath) => {
  if (!attachmentPath || typeof attachmentPath !== 'string') return null;
  let normalized = attachmentPath.replace(/\\/g, '/');
  if (normalized.startsWith('/api/uploads/')) {
    normalized = normalized.replace(/^\/api\/uploads\//, '/uploads/');
  }
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
    const { title, description, priority, status, assigned_to, assigned_to_ids, due_date } = req.body;
    const user_id = req.user?.userId;
    const requesterRole = req.user?.role;
    const managementUser = isManagementRole(requesterRole);

    const requestedAssigneeIds = extractAssigneeIds(assigned_to_ids, assigned_to);
    const assigneeIds = managementUser ? requestedAssigneeIds : requestedAssigneeIds.slice(0, 1);

    if (!title || !user_id || !due_date) {
      return res.status(400).json({ success: false, message: 'Title, user_id (creator) and due_date are required' });
    }
    if (!assigneeIds.length) {
      return res.status(400).json({ success: false, message: 'Assignee is required' });
    }

    if (!managementUser) {
      try {
        const tgtRes = await pool.query(
          `
            SELECT DISTINCT LOWER(r.role_name) AS role_name
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.id = ANY($1::int[]) AND ur.status = 'active'
          `,
          [assigneeIds]
        );
        if ((tgtRes.rows || []).some((row) => row.role_name === 'management')) {
          return res.status(403).json({ success: false, message: 'You are not allowed to assign tickets to Management users' });
        }
      } catch (error) {
        console.error('Role-check error on createTicket:', error);
      }
    }

    // If a file was uploaded, build a URL path for it
    let attachmentUrl = null;
    if (req.file && req.file.filename) {
      // Serve from /api/uploads/tickets/<filename>
      attachmentUrl = `${ticketUploadsBasePath}/${req.file.filename}`;
    } else if (req.body.attachment) {
      // fallback when client posted a string
      attachmentUrl = req.body.attachment;
    }

    const ticketData = {
      title,
      description: description || '',
      priority: priority || null,
      status: status || null,
      user_id,
      due_date,
      attachment: attachmentUrl || null,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = await ticketModel.createTicket(ticketData, client);
      await syncTicketAssignees(client, created.id, assigneeIds, user_id);
      const enrichedCreated = await ticketModel.getTicketById(created.id, client);
      await client.query('COMMIT');

      // Create in-app notification for all assignees. Fail silently on error.
      (async () => {
        try {
          const tTitle = enrichedCreated?.title || '';
          const tDesc = enrichedCreated?.description || '';
          const message = `You were assigned a ticket.\nTitle: ${tTitle}\nDescription: ${tDesc}`;
          await Promise.all(
            assigneeIds.map((assigneeId) => notificationModel.createNotification({
              created_by: user_id,
              assigned_to: assigneeId,
              message,
              type: 'ticket',
            }))
          );
        } catch (notifErr) {
          console.error('Create ticket notification error:', notifErr);
        }
      })();

      return res.status(201).json({ success: true, data: enrichedCreated });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create ticket error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create ticket', error: error.message });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const role = req.user?.role;
    const tickets = await ticketModel.getTicketsForUser(userId, role);
    const enriched = (tickets || []).map(t => ({ ...(t || {}), ...(String(t?.status || '').toLowerCase() === 'rejected' ? { rejected_date: t.updated_at } : {}) }));
    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets', error: error.message });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const ticket = await ticketModel.getTicketById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Authorization: only Creator, Assignee, or Management may view a ticket
    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;
    const isManagement = isManagementRole(requesterRole);
    const isCreator = String(ticket.user_id) === String(requesterId);
    const isAssignee = ticketHasAssignee(ticket, requesterId);

    // Allow viewing if Management, creator, assignee, or HOD of same department as creator
    if (!isManagement && !isCreator && !isAssignee) {
      try {
        const reqRoleNorm = requesterRole ? String(requesterRole).toLowerCase() : '';
        let isHodSameDept = false;
        if (reqRoleNorm === 'hod') {
          const deptRes = await pool.query('SELECT id, department_id FROM users WHERE id = ANY($1)', [[requesterId, ticket.user_id]]);
          const rowsById = (deptRes.rows || []).reduce((acc, r) => ({ ...acc, [String(r.id)]: r }), {});
          const requesterDept = rowsById[String(requesterId)] ? rowsById[String(requesterId)].department_id : null;
          const creatorDept = rowsById[String(ticket.user_id)] ? rowsById[String(ticket.user_id)].department_id : null;
          if (requesterDept && creatorDept && String(requesterDept) === String(creatorDept)) {
            isHodSameDept = true;
          }
        }
        if (!isHodSameDept) {
          return res.status(403).json({ success: false, message: 'You are not authorized to view this ticket' });
        }
      } catch (e) {
        console.error('Department-check error on getTicketById:', e);
        return res.status(403).json({ success: false, message: 'You are not authorized to view this ticket' });
      }
    }

    const enriched = { ...(ticket || {}), ...(String(ticket?.status || '').toLowerCase() === 'rejected' ? { rejected_date: ticket.updated_at } : {}) };
    res.status(200).json({ success: true, data: enriched });
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
      payload.attachment = `${ticketUploadsBasePath}/${req.file.filename}`;
    } else if (payload.attachment === '') {
      payload.attachment = null;
    }

    // fetch existing ticket to enforce rules
    const existing = await ticketModel.getTicketById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;
    const managementUser = isManagementRole(requesterRole);

    const existingAssigneeIds = getTicketAssigneeIds(existing);
    const requestedAssigneeIds = extractAssigneeIds(payload.assigned_to_ids, payload.assigned_to);
    const assigneeIds = managementUser
      ? requestedAssigneeIds
      : (requestedAssigneeIds.length ? requestedAssigneeIds.slice(0, 1) : existingAssigneeIds);

    if (!assigneeIds.length) {
      return res.status(400).json({ success: false, message: 'Assignee is required' });
    }

    // Allowed status transitions map — simplified: only Open -> Rejected or Closed allowed
    const allowedTransitions = {
      Open: ['Rejected', 'Closed'],
      Rejected: [],
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
    // (HOD role is NOT allowed unless also creator)
    const isManagement = managementUser;
    const isCreator = String(existing.user_id) === String(requesterId);
    const isHod = requesterRole && requesterRole.toLowerCase() === 'hod';

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
        // Explicitly block HOD role and all others
        return res.status(403).json({ success: false, message: 'Only Management or the ticket creator can edit due_date' });
      }
    }

    // Other users can only edit title and description
    const isAssignee = ticketHasAssignee(existing, requesterId);
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

    // Rejection is handled below and is restricted to Management users.

    // If trying to set status to Closed, only allow the creator
    if (payload.status && String(payload.status) === 'Closed') {
      if (String(existing.user_id) !== String(requesterId)) {
        return res.status(403).json({ success: false, message: 'Only the ticket creator can set status to Closed' });
      }
    }

    // New rule: if requester is Employee or HOD, they cannot set assigned_to to a Management user
    try {
      const reqRoleNorm = requesterRole ? String(requesterRole).toLowerCase() : '';
      if (assigneeIds.length && (reqRoleNorm === 'employee' || reqRoleNorm === 'hod')) {
        const tgtRes = await pool.query(
          `
            SELECT DISTINCT LOWER(r.role_name) AS role_name
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON ur.role_id = r.id
            WHERE u.id = ANY($1::int[]) AND ur.status = 'active'
          `,
          [assigneeIds]
        );
        const hasManagementAssignee = (tgtRes.rows || []).some((row) => row.role_name === 'management');
        if (hasManagementAssignee) {
          return res.status(403).json({ success: false, message: 'You are not allowed to assign tickets to Management users' });
        }
      }
    } catch (e) {
      console.error('Role-check error on updateTicket:', e);
      // don't block on DB error
    }

    // On any status change, notify creator and all HODs (no assignee notification)
    let sentStatusNotification = false;
    if (payload.status && payload.status !== existing.status) {
      try {
        const pool = require('../config/db');
        // Find all users with HOD role
        const hodRes = await pool.query(`
          SELECT u.id FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
          WHERE r.role_name = 'HOD' AND ur.status = 'active'
        `);
        const hodIds = hodRes.rows.map(r => r.id).filter(id => id !== existing.user_id);
        
        if (payload.status === 'Rejected') {
          const reqRoleNorm = requesterRole ? String(requesterRole).toLowerCase() : '';
          if (reqRoleNorm !== 'management') {
            return res.status(403).json({ success: false, message: 'Only Management users can reject tickets' });
          }

          try {
            const creatorMessage = `Type: Ticket rejected\nTitle: ${existing.title}\nDescription: ${existing.description || ''}`;
            await notificationModel.createNotification({ created_by: requesterId, assigned_to: existing.user_id, message: creatorMessage, type: 'ticket_status' });
          } catch (e) {
            console.error('Error handling Rejected transition:', e);
          }
        }
        sentStatusNotification = true;
      } catch (notifErr) {
        console.error('Status-change notification error:', notifErr);
      }
    }

    // If not a status change, but other fields were edited, notify the assignee (if any)
    if (!sentStatusNotification) {
      // Check if any editable field other than status was changed
      const editableFields = ['title', 'description', 'priority', 'due_date', 'attachment'];
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
    const client = await pool.connect();
    let updated;
    try {
      await client.query('BEGIN');
      updated = await ticketModel.updateTicket(id, payload, client);
      await syncTicketAssignees(client, id, assigneeIds, requesterId);
      updated = await ticketModel.getTicketById(id, client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    console.log('DEBUG: Updated ticket result', updated);
    if (!updated) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const newlyAssignedUserIds = assigneeIds.filter((userId) => !existingAssigneeIds.includes(userId));

    const replacedOrClearedAttachment = Boolean(req.file && req.file.filename) || payload.attachment === null;
    if (replacedOrClearedAttachment && existing.attachment && existing.attachment !== updated.attachment) {
      await removeLocalAttachmentIfExists(existing.attachment);
    }

    // If reassigned to a different user, create an in-app notification for the new assignee(s).
    try {
      if (newlyAssignedUserIds.length > 0) {
        const tTitle = updated.title || '';
        const tDesc = updated.description || '';
        const message = `You were assigned a ticket.\nTitle: ${tTitle}\nDescription: ${tDesc}`;
        await Promise.all(
          newlyAssignedUserIds.map((assigneeId) => notificationModel.createNotification({ created_by: requesterId, assigned_to: assigneeId, message, type: 'ticket' }))
        );
      }
    } catch (notifErr) {
      console.error('Update ticket notification error:', notifErr);
    }

    try {
      if (String(updated.status || '').toLowerCase() === 'rejected') {
        updated.rejected_date = updated.updated_at;
      }
    } catch (e) {
      console.error('Error attaching rejected_date to updated ticket:', e);
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