import axios from './axios';

// Get all ticket counts
export const getTicketCounts = async () => {
  return await axios.get('/dev-tickets/counts');
};

// Get all tickets
export const getAllTickets = async () => {
  return await axios.get('/dev-tickets');
};

// Create a new ticket
export const createTicket = async (data) => {
  return await axios.post('/dev-tickets', data);
};

// Update a ticket
export const updateTicket = async (id, data) => {
  return await axios.put(`/dev-tickets/${id}`, data);
};
