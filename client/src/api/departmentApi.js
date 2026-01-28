import axios from './axios';

export const getDepartments = async () => {
  return await axios.get('/departments');
};

export const getDepartmentById = async (id) => {
  return await axios.get(`/departments/${id}`);
};

export const createDepartment = async (data) => {
  return await axios.post('/departments', data);
};

export const updateDepartment = async (id, data) => {
  return await axios.put(`/departments/${id}`, data);
};

export const deleteDepartment = async (id) => {
  return await axios.delete(`/departments/${id}`);
};
