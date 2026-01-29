import axios from './axios';

export const getUserRoles = async () => {
  return await axios.get('/user-roles');
};

export const getUserRoleById = async (id) => {
  return await axios.get(`/user-roles/${id}`);
};

export const createUserRole = async (data) => {
  return await axios.post('/user-roles', data);
};

export const updateUserRole = async (id, data) => {
  return await axios.put(`/user-roles/${id}`, data);
};

export const deleteUserRole = async (id) => {
  return await axios.delete(`/user-roles/${id}`);
};

export const getUserRolesByUserId = async (userId) => {
  return await axios.get(`/user-roles/user/${userId}`);
};
