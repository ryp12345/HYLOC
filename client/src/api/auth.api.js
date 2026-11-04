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

  // Returns a fresh session ({ accessToken, refreshToken, role }): the change ends all earlier sessions
  changePassword: (currentPassword, newPassword, confirmPassword) =>
    axiosInstance.post('/auth/change-password', { currentPassword, newPassword, confirmPassword })
};
