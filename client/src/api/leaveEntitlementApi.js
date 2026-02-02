import axios from './axios';

const BASE_URL = '/api/leave-entitlements';

export const getEntitlements = (year, token) =>
  axios.get(`${BASE_URL}?year=${year}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const getStaffWithStatus = (year, token) =>
  axios.get(`${BASE_URL}/staff?year=${year}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const assignLeave = (data, token) =>
  axios.post(`${BASE_URL}/assign`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const bulkAssignLeave = (assignments, token) =>
  axios.post(`${BASE_URL}/bulk-assign`, { assignments }, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const updateEntitlement = (id, data, token) =>
  axios.put(`${BASE_URL}/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const deleteEntitlement = (id, token) =>
  axios.delete(`${BASE_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
