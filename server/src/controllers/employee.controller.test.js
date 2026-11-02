jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ logError: jest.fn() }));
jest.mock('../services/kpiCalculation.service', () => ({
  calculateKPIValue: jest.fn(),
  recalculateDependentKPIs: jest.fn()
}));

const pool = require('../config/db');
const controller = require('./employee.controller');

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return response;
};

describe('submitKPIData authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the logged-in employee ID and rejects an unassigned KPI', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, empid: 101, department_id: 4 }] })
      .mockResolvedValueOnce({
        rows: [{
          kpi_type: 'manual',
          kpi_id: 7,
          data_operator: 101,
          default_target_value: null,
          target_formula: null,
          formula: null
        }]
      })
      .mockResolvedValueOnce({ rows: [] });
    const response = createResponse();

    await controller.submitKPIData({
      user: { userId: 1, role: 'Employee' },
      body: { empId: 202, kpiId: 7, kpiValueId: 9, month: 4, year: 2026, actualValue: 5 }
    }, response);

    expect(response.statusCode).toBe(403);
    expect(pool.query.mock.calls[2][1]).toEqual([7, '101']);
    expect(pool.query.mock.calls.some(([query]) => /INSERT INTO kpi_data_value|UPDATE kpi_data_value/i.test(query))).toBe(false);
  });

  test('prevents an HOD from submitting for another department', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, empid: 101, department_id: 4 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, empid: 202, department_id: 5 }] });
    const response = createResponse();

    await controller.submitKPIData({
      user: { userId: 1, role: 'HOD' },
      body: { empId: 202, kpiId: 7, kpiValueId: 9, month: 4, year: 2026, actualValue: 5 }
    }, response);

    expect(response.statusCode).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
