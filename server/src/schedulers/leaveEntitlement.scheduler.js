const cron = require('node-cron');
const { grantAnnualEntitlementsForYear } = require('../services/leaveEntitlement.service');

// Once a year: 1 January at 00:05 (min hr dom mon dow), server local time.
// Entitlements for the year that is starting are granted from the previous
// year's final balance and working days.
const CRON_EXPRESSION = '5 0 1 1 *';

const grantForCurrentYear = async (trigger) => {
  const year = new Date().getFullYear();
  try {
    const granted = await grantAnnualEntitlementsForYear(year);
    console.log(`Annual leave entitlements (${trigger}) for year ${year}. Rows created or filled: ${granted}`);
  } catch (error) {
    console.error('Failed to grant annual leave entitlements:', error);
  }
};

const startAnnualLeaveScheduler = () => {
  cron.schedule(CRON_EXPRESSION, () => grantForCurrentYear('scheduled'));

  // Catch up if the server was not running on 1 January. Safe to repeat:
  // only missing rows and untouched placeholder rows are filled.
  grantForCurrentYear('startup check');
};

module.exports = { startAnnualLeaveScheduler };
