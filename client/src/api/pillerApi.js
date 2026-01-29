import axios from './axios';

export const getPillers = async () => {
  return await axios.get('/pillers');
};

export const getPillerById = async (id) => {
  return await axios.get(`/pillers/${id}`);
};

export const createPiller = async (data) => {
  return await axios.post('/pillers', data);
};

export const updatePiller = async (id, data) => {
  return await axios.put(`/pillers/${id}`, data);
};

export const deletePiller = async (id) => {
  return await axios.delete(`/pillers/${id}`);
};
