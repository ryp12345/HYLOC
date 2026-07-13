import axios from './axios';

export const getUsers = async () => {
  return await axios.get('/users');
};

export const getAssignableUsers = async () => {
  return await axios.get('/users/assignable');
};

export const getUserById = async (id) => {
  return await axios.get(`/users/${id}`);
};

export const getUsersByDepartment = async (departmentId) => {
  return await axios.get(`/users/department/${departmentId}`);
};

export const createUser = async (data) => {
  if (data instanceof FormData) {
    return await axios.post('/users', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
  return await axios.post('/users', data);
};

export const updateUser = async (id, data) => {
  if (data instanceof FormData) {
    return await axios.put(`/users/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
  return await axios.put(`/users/${id}`, data);
};

export const deleteUser = async (id) => {
  return await axios.delete(`/users/${id}`);
};
