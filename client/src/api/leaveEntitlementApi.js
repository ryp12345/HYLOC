import axios from './axios';

const BASE_URL = '/leave-entitlements';

export const getEntitlements = (year, token) =>
  axios.get(`${BASE_URL}?year=${year}`);

export const getStaffWithStatus = (year, token) =>
  axios.get(`${BASE_URL}/staff?year=${year}`);

export const assignLeave = (data, token) =>
  axios.post(`${BASE_URL}/assign`, data);

export const bulkAssignLeave = (assignments, token) =>
  axios.post(`${BASE_URL}/bulk-assign`, { assignments });

export const updateEntitlement = (id, data, token) =>
  axios.put(`${BASE_URL}/${id}`, data);

export const deleteEntitlement = (id, token) =>
  axios.delete(`${BASE_URL}/${id}`);
