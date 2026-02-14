export const deleteNotification = async (id) => {
  return api.delete(`/notifications/${id}`);
};
 import api from './axios';

export const getNotifications = async () => {
  return api.get('/notifications/my');
};

export const markNotificationAsRead = async (id) => {
  return api.put(`/notifications/${id}`);
};
