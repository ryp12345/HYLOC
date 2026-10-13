import axios from './axios';

const BASE_URL = '/leave-entitlements';

export const getEntitlements = (year, token) =>
  axios.get(`${BASE_URL}?year=${year}`);

export const getStaffWithStatus = (year, token) =>
  axios.get(`${BASE_URL}/staff?year=${year}`);

export const getMonthlyWorkingDaysStaff = (month, token, year) =>
  axios.get(`${BASE_URL}/monthly/staff`, { params: { month, year } });

export const importMonthlyWorkingDays = (month, assignments, token, year) =>
  axios.post(`${BASE_URL}/monthly/import`, { month, year, assignments });

export const importLeaveEntitlements = (assignments, token) =>
  axios.post(`${BASE_URL}/import`, { assignments });

export const updateEntitlement = (id, data, token) =>
  axios.put(`${BASE_URL}/${id}`, data);

export const deleteEntitlement = (id, token) =>
  axios.delete(`${BASE_URL}/${id}`);
