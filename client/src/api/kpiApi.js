import axios from './axios';

export const getKPIs = async () => {
  return await axios.get('/kpis');
};

export const getKPIById = async (id) => {
  return await axios.get(`/kpis/${id}`);
};

export const getChildKPIs = async (parentId) => {
  return await axios.get(`/kpis/${parentId}/children`);
};

export const getKPIsByCategory = async (categoryId) => {
  return await axios.get(`/kpis/category/${categoryId}`);
};

export const getKPIsByFinYear = async (finYear) => {
  return await axios.get(`/kpis/fin-year/${finYear}`);
};

export const createKPI = async (data) => {
  return await axios.post('/kpis', data);
};

export const updateKPI = async (id, data) => {
  return await axios.put(`/kpis/${id}`, data);
};

export const deleteKPI = async (id) => {
  return await axios.delete(`/kpis/${id}`);
};

// KPI Values
export const getKPIValues = async () => {
  return await axios.get('/kpi-values');
};

export const getKPIValueById = async (id) => {
  return await axios.get(`/kpi-values/${id}`);
};

export const getKPIValueMonthlyData = async (kpiValueId, year) => {
  return await axios.get(`/kpi-values/${kpiValueId}/monthly-data/${year}`);
};

export const getKPIValuesByKPI = async (kpiId) => {
  return await axios.get(`/kpi-values/kpi/${kpiId}`);
};

export const getKPIValuesByPillar = async (pillerId) => {
  return await axios.get(`/kpi-values/pillar/${pillerId}`);
};

export const getKPIValueByData = async (dataValue) => {
  return await axios.get(`/kpi-values/by-data`, { params: { dataValue } });
};

export const createKPIValue = async (data) => {
  return await axios.post('/kpi-values', data);
};

export const updateKPIValue = async (id, data) => {
  return await axios.put(`/kpi-values/${id}`, data);
};

export const deleteKPIValue = async (id) => {
  return await axios.delete(`/kpi-values/${id}`);
};

// KPI Data Values
export const getKPIDataValues = async () => {
  return await axios.get('/kpi-data-values');
};

export const getKPIDataValueById = async (id) => {
  return await axios.get(`/kpi-data-values/${id}`);
};

export const getMonthlyDataByKPIValue = async (kpiValueId, year) => {
  return await axios.get(`/kpi-data-values/${kpiValueId}/monthly`, { params: { year } });
};

export const getMultipleKPIValuesData = async (kpiValueIds, year) => {
  return await axios.post(`/kpi-data-values/multiple`, { kpiValueIds, year });
};

export const createKPIDataValue = async (data) => {
  return await axios.post('/kpi-data-values', data);
};

export const updateKPIDataValue = async (id, data) => {
  return await axios.put(`/kpi-data-values/${id}`, data);
};

export const deleteKPIDataValue = async (id) => {
  return await axios.delete(`/kpi-data-values/${id}`);
};

// KPI Departments
export const getKPIDepartments = async () => {
  return await axios.get('/kpi-departments');
};

export const getKPIDepartmentsByKPI = async (kpiId) => {
  return await axios.get(`/kpi-departments/kpi/${kpiId}`);
};

export const getKPIDepartmentsByDepartment = async (departmentId) => {
  return await axios.get(`/kpi-departments/department/${departmentId}`);
};

export const createKPIDepartment = async (data) => {
  return await axios.post('/kpi-departments', data);
};

export const deleteKPIDepartment = async (id) => {
  return await axios.delete(`/kpi-departments/${id}`);
};

export const deleteKPIDepartmentsByKPI = async (kpiId) => {
  return await axios.delete(`/kpi-departments/kpi/${kpiId}`);
};

// KPI Employees
export const getKPIEmployees = async () => {
  return await axios.get('/kpi-employees');
};

export const getKPIEmployeesByKPI = async (kpiId) => {
  return await axios.get(`/kpi-employees/kpi/${kpiId}`);
};

export const getKPIEmployeesByEmployee = async (empId) => {
  return await axios.get(`/kpi-employees/employee/${empId}`);
};

// Employee-specific KPI endpoints
export const getEmployeeKPIValues = async (empId) => {
  return await axios.get(`/employees/${empId}/kpi-values`);
};

export const createKPIEmployee = async (data) => {
  return await axios.post('/kpi-employees', data);
};

export const deleteKPIEmployee = async (id) => {
  return await axios.delete(`/kpi-employees/${id}`);
};

export const deleteKPIEmployeesByKPI = async (kpiId) => {
  return await axios.delete(`/kpi-employees/kpi/${kpiId}`);
};
