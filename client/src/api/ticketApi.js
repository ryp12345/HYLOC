import axios from './axios';

export const getTicketPriorities = async (token) => {
  return await axios.get('/tickets/priorities', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
};

export const createTicket = async (data) => {
  if (data instanceof FormData) {
    return await axios.post('/tickets', data, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return await axios.post('/tickets', data);
};

export const getAllTickets = async () => {
  return await axios.get('/tickets');
};

// Get tickets created by the logged-in user
export const getMyTickets = async () => {
  return await axios.get('/tickets/my-tickets');
};

export const getTicketStatuses = async () => {
  return await axios.get('/tickets/statuses');
};

export const getTicketById = async (id) => {
  return await axios.get(`/tickets/${id}`);
};

export const updateTicket = async (id, data) => {
  if (data instanceof FormData) {
    return await axios.put(`/tickets/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return await axios.put(`/tickets/${id}`, data);
};

export const deleteTicket = async (id) => {
  return await axios.delete(`/tickets/${id}`);
};
