import axiosInstance from './axios';

export const authAPI = {
  register: (email, password, firstName, lastName) =>
    axiosInstance.post('/auth/register', { email, password, firstName, lastName }),

  login: (empid, password) =>
    axiosInstance.post('/auth/login', { empid, password }),

  refreshToken: (refreshToken) =>
    axiosInstance.post('/auth/refresh-token', { refreshToken }),

  getProfile: () =>
    axiosInstance.get('/auth/profile')
  ,

  changePassword: (currentPassword, newPassword) =>
    axiosInstance.post('/auth/change-password', { currentPassword, newPassword })
};
