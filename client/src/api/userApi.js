import axios from './axios';

export const getUsers = async () => {
  return await axios.get('/users');
};

export const getUserById = async (id) => {
  return await axios.get(`/users/${id}`);
};

export const createUser = async (data) => {
  return await axios.post('/users', data);
};

export const updateUser = async (id, data) => {
  return await axios.put(`/users/${id}`, data);
};

export const deleteUser = async (id) => {
  return await axios.delete(`/users/${id}`);
};
