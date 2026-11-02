import axiosInstance from './axios';

export const authAPI = {
  login: (empid, password) =>
    axiosInstance.post('/auth/login', { empid, password }),

  refreshToken: (refreshToken, selectedRole) =>
    axiosInstance.post('/auth/refresh-token', { refreshToken, ...(selectedRole ? { selectedRole } : {}) }),

  switchRole: (role) =>
    axiosInstance.post('/auth/switch-role', { role }),

  getProfile: () =>
    axiosInstance.get('/auth/profile')
  ,

  changePassword: (currentPassword, newPassword) =>
    axiosInstance.post('/auth/change-password', { currentPassword, newPassword })
};
