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
const kpiDataValueRoutes = require('./routes/kpi-data-value.routes');
const kpiDepartmentRoutes = require('./routes/kpi-department.routes');
const kpiEmployeeRoutes = require('./routes/kpi-employee.routes');
const employeeRoutes = require('./routes/employee.routes');
const categoryRoutes = require('./routes/category.routes');
const leaveRoutes = require('./routes/leave.routes');
const unitMasterRoutes = require('./routes/unitMaster.routes');
const leaveEntitlementRoutes = require('./routes/leaveEntitlement.routes');
const devTicketsRoutes = require('./routes/devTickets.routes');
const ticketRoutes = require('./routes/ticket.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const notificationRoutes = require('./routes/notification.routes');

const app = express();
const fs = require('fs');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(config.cors));

const path = require('path');
// Serve uploaded files
const uploadsPath = path.join(__dirname, '../public/uploads');
app.use('/uploads', express.static(uploadsPath));
app.use('/api/uploads', express.static(uploadsPath));

const userUploadsPath = path.join(uploadsPath, 'users');
const userPhotoExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

const findUserPhotoFile = (requestedName) => {
  if (!requestedName) return '';

  const normalizedName = String(requestedName).replace(/^\/+/, '');
  const directFilePath = path.join(userUploadsPath, normalizedName);

  if (fs.existsSync(directFilePath) && fs.statSync(directFilePath).isFile()) {
    return directFilePath;
  }

  const baseName = path.parse(normalizedName).name || normalizedName;
  const extension = path.parse(normalizedName).ext;
  const candidateNames = new Set();

  if (extension) {
    candidateNames.add(`${baseName}${extension}`);
    candidateNames.add(`${baseName}${extension.toLowerCase()}`);
    candidateNames.add(`${baseName}${extension.toUpperCase()}`);
  }

  userPhotoExtensions.forEach((ext) => {
    candidateNames.add(`${baseName}.${ext}`);
    candidateNames.add(`${baseName}.${ext.toUpperCase()}`);
  });

  for (const candidateName of candidateNames) {
    const candidatePath = path.join(userUploadsPath, candidateName);
    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      return candidatePath;
    }
  }

  if (fs.existsSync(userUploadsPath)) {
    const lowerTarget = normalizedName.toLowerCase();
    const matchedFile = fs.readdirSync(userUploadsPath).find((entry) => entry.toLowerCase() === lowerTarget);
    if (matchedFile) {
      const matchedPath = path.join(userUploadsPath, matchedFile);
      if (fs.existsSync(matchedPath) && fs.statSync(matchedPath).isFile()) {
        return matchedPath;
      }
    }
  }

  return '';
};

app.get('/api/uploads/users/:fileName', (req, res, next) => {
  const requestedName = String(req.params.fileName || '').trim();
  if (!requestedName) {
    return next();
  }

  const matchedPath = findUserPhotoFile(requestedName);
  if (matchedPath) {
    return res.sendFile(matchedPath);
  }

  return next();
});

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
app.use('/api/employees', employeeRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api/pillers', pillerRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/kpi-values', kpiValueRoutes);
app.use('/api/kpi-data-values', kpiDataValueRoutes);
app.use('/api/kpi-departments', kpiDepartmentRoutes);
app.use('/api/kpi-employees', kpiEmployeeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/unit-master', unitMasterRoutes);
app.use('/api/dev-tickets', devTicketsRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/notifications', notificationRoutes);

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
