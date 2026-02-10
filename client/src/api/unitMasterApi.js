import axios from './axios';

export const getAllUnitMasters = async () => {
  return await axios.get('/unit-master');
};

export const createUnitMaster = async (payload) => {
  return await axios.post('/unit-master', payload);
};

export const updateUnitMaster = async (id, payload) => {
  return await axios.put(`/unit-master/${id}`, payload);
};

export const deleteUnitMaster = async (id) => {
  return await axios.delete(`/unit-master/${id}`);
};
