const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// GET /api/tickets/priorities
router.get('/priorities', authenticate, ticketController.getTicketPriorities);

// GET /api/tickets/statuses
router.get('/statuses', authenticate, ticketController.getTicketStatuses);

// POST /api/tickets - Create a new ticket (accepts optional file 'attachment')
router.post('/', authenticate, upload.single('attachment'), ticketController.createTicket);


// GET /api/tickets/my-tickets - list tickets created by the logged-in user
router.get('/my-tickets', authenticate, ticketController.getMyTickets);

// GET /api/tickets - list all tickets
router.get('/', authenticate, ticketController.getAllTickets);

// GET /api/tickets/:id
router.get('/:id', authenticate, ticketController.getTicketById);

// PUT /api/tickets/:id - update ticket (accepts optional file 'attachment')
router.put('/:id', authenticate, upload.single('attachment'), ticketController.updateTicket);

// DELETE /api/tickets/:id
router.delete('/:id', authenticate, ticketController.deleteTicket);

module.exports = router;
