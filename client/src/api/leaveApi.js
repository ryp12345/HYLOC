import axios from './axios';

/**
 * Check if user is eligible to apply for leave
 */
export const checkLeaveEligibility = async () => {
  return await axios.get('/leaves/eligibility');
};

/**
 * Get department colleagues for alternate person selection
 */
export const getDepartmentColleagues = async () => {
  return await axios.get('/leaves/department-colleagues');
};

/**
 * Get department colleague leaves (for Employee/Manager calendar view)
 */
export const getDepartmentLeaves = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.year) params.append('year', filters.year);
  
  const query = params.toString();
  return await axios.get(`/leaves/department-leaves${query ? `?${query}` : ''}`);
};

/**
 * Apply for leave
 */
export const applyLeave = async (leaveData) => {
  return await axios.post('/leaves', leaveData);
};

/**
 * Get my leaves (current user's leaves)
 */
export const getMyLeaves = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.year) params.append('year', filters.year);
  if (filters.from_date) params.append('from_date', filters.from_date);
  if (filters.to_date) params.append('to_date', filters.to_date);
  
  const query = params.toString();
  return await axios.get(`/leaves/my-leaves${query ? `?${query}` : ''}`);
};

/**
 * Get leave by ID
 */
export const getLeaveById = async (id) => {
  return await axios.get(`/leaves/${id}`);
};

/**
 * Update pending leave
 */
export const updateLeave = async (id, updateData) => {
  return await axios.put(`/leaves/${id}`, updateData);
};

/**
 * Cancel (delete) pending leave
 */
export const cancelLeave = async (id) => {
  return await axios.delete(`/leaves/${id}`);
};

/**
 * Get my leave balance
 */
export const getMyLeaveBalance = async (year = null) => {
  const query = year ? `?year=${year}` : '';
  return await axios.get(`/leaves/balance${query}`);
};

/**
 * Get leave history for a specific year
 */
export const getLeaveHistory = async (year) => {
  return await axios.get(`/leaves/history/${year}`);
};

/**
 * Get pending leaves (for Manager/Management approval)
 */
export const getPendingLeaves = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.department_id) params.append('department_id', filters.department_id);
  
  const query = params.toString();
  return await axios.get(`/leaves/pending${query ? `?${query}` : ''}`);
};

/**
 * Get all leaves (for Management and Manager)
 */
export const getAllLeaves = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.department_id) params.append('department_id', filters.department_id);
  if (filters.year) params.append('year', filters.year);
  if (filters.min_duration) params.append('min_duration', filters.min_duration);
  
  const query = params.toString();
  return await axios.get(`/leaves/all${query ? `?${query}` : ''}`);
};

/**
 * Approve leave (Manager/Management)
 */
export const approveLeave = async (id) => {
  return await axios.post(`/leaves/${id}/approve`, {});
};

/**
 * Reject leave (Manager/Management)
 */
export const rejectLeave = async (id) => {
  return await axios.post(`/leaves/${id}/reject`, {});
};
