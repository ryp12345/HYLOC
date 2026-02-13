 import api from './axios';

export const getNotifications = async () => {
  return api.get('/notifications/my');
};

export const markNotificationAsRead = async (id) => {
  return api.patch(`/notifications/${id}/read`);
};
