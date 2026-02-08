const express = require('express');
const router = express.Router();
const devTicketsController = require('../controllers/devTickets.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// GET /api/dev-tickets/counts - Get all ticket counts
router.get('/counts', authenticate, devTicketsController.getTicketCounts);

// GET /api/dev-tickets - Get all tickets
router.get('/', authenticate, devTicketsController.getAllTickets);


// POST /api/dev-tickets - Create a new ticket
router.post('/', authenticate, devTicketsController.createTicket);

// PUT /api/dev-tickets/:id - Update a ticket
router.put('/:id', authenticate, devTicketsController.updateTicket);

module.exports = router;
