const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const departmentRoutes = require('./routes/department.routes');
const designationRoutes = require('./routes/designation.routes');
const associationRoutes = require('./routes/association.routes');
const roleRoutes = require('./routes/role.routes');
const userRoleRoutes = require('./routes/userRole.routes');
const pillerRoutes = require('./routes/piller.routes');
const kpiRoutes = require('./routes/kpi.routes');
const kpiValueRoutes = require('./routes/kpi-value.routes');
const kpiDepartmentRoutes = require('./routes/kpi-department.routes');
const categoryRoutes = require('./routes/category.routes');
const leaveRoutes = require('./routes/leave.routes');
const unitRoutes = require('./routes/unit.routes');
const leaveEntitlementRoutes = require('./routes/leaveEntitlement.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(config.cors));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/associations', associationRoutes);
app.use('/api/roles', roleRoutes);
const employeeRoutes = require('./routes/employee.routes');
app.use('/api/employees', employeeRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api/pillers', pillerRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/kpi-values', kpiValueRoutes);
app.use('/api/kpi-departments', kpiDepartmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/unit-master', unitRoutes);

// Leave Entitlement routes
app.use('/api/leave-entitlements', leaveEntitlementRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running', timestamp: new Date().toISOString() });
});

// Test endpoint for leave entitlements (no auth for testing)
app.get('/api/test/leave-entitlements', (req, res) => {
  res.json({ message: 'Leave entitlements endpoint exists', path: '/api/leave-entitlements' });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
