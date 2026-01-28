import axios from './axios';

export const getAssociations = async () => {
  return await axios.get('/associations');
};

export const getAssociationById = async (id) => {
  return await axios.get(`/associations/${id}`);
};

export const createAssociation = async (data) => {
  return await axios.post('/associations', data);
};

export const updateAssociation = async (id, data) => {
  return await axios.put(`/associations/${id}`, data);
};

export const deleteAssociation = async (id) => {
  return await axios.delete(`/associations/${id}`);
};
