import axios from './axios';

const BASE_URL = '/leave-entitlements';

export const getEntitlements = (year, token) =>
  axios.get(`${BASE_URL}?year=${year}`);

export const getStaffWithStatus = (year, token) =>
  axios.get(`${BASE_URL}/staff?year=${year}`);

export const getMonthlyWorkingDaysStaff = (month, token) =>
  axios.get(`${BASE_URL}/monthly/staff?month=${month}`);

export const importMonthlyWorkingDays = (month, assignments, token) =>
  axios.post(`${BASE_URL}/monthly/import`, { month, assignments });

export const importLeaveEntitlements = (assignments, token) =>
  axios.post(`${BASE_URL}/import`, { assignments });

export const updateEntitlement = (id, data, token) =>
  axios.put(`${BASE_URL}/${id}`, data);

export const deleteEntitlement = (id, token) =>
  axios.delete(`${BASE_URL}/${id}`);
