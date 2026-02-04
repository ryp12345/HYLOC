import axios from './axios';

export const getAllUnitMasters = async () => {
  return await axios.get('/unit-master');
};
