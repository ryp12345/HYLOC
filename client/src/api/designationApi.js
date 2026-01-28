import axios from './axios';

export const getDesignations = async () => {
  return await axios.get('/designations');
};

export const getDesignationById = async (id) => {
  return await axios.get(`/designations/${id}`);
};

export const createDesignation = async (data) => {
  return await axios.post('/designations', data);
};

export const updateDesignation = async (id, data) => {
  return await axios.put(`/designations/${id}`, data);
};

export const deleteDesignation = async (id) => {
  return await axios.delete(`/designations/${id}`);
};
