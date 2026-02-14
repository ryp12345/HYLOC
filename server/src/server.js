const app = require('./app');
const config = require('./config');
const os = require('os');
const { startAnnualLeaveScheduler } = require('./schedulers/leaveEntitlement.scheduler');
const { startOverdueScheduler } = require('./schedulers/overdueTickets.scheduler');

const PORT = config.port || 3001;
const HOST = '0.0.0.0';

const getLocalIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const localIP = getLocalIPAddress();

app.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access via localhost: http://localhost:${PORT}`);
  console.log(`Access via network: http://${localIP}:${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  startAnnualLeaveScheduler();
  startOverdueScheduler();
});
