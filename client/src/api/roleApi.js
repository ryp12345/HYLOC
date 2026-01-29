import axios from './axios';

export const getRoles = async () => {
  return await axios.get('/roles');
};

export const getRoleById = async (id) => {
  return await axios.get(`/roles/${id}`);
};

export const createRole = async (data) => {
  return await axios.post('/roles', data);
};

export const updateRole = async (id, data) => {
  return await axios.put(`/roles/${id}`, data);
};

export const deleteRole = async (id) => {
  return await axios.delete(`/roles/${id}`);
};
