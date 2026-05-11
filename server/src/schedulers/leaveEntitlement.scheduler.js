const cron = require('node-cron');
const { grantAnnualEntitlementsForYear } = require('../services/leaveEntitlement.service');

//const CRON_EXPRESSION = '45 18 31 1 *'; // Jan 31st at 6:45 PM (min hr dom mon dow)
const CRON_EXPRESSION = '50 14 11 5 *'; // Feb 4th at 12:01 PM (min hr dom mon dow)

const startAnnualLeaveScheduler = () => {
  cron.schedule(CRON_EXPRESSION, async () => {
    const year = new Date().getFullYear();
    try {
      const inserted = await grantAnnualEntitlementsForYear(year);
      //console.log(`Annual leave entitlements granted for year ${year}. Inserted: ${inserted}`);
    } catch (error) {
      console.error('Failed to grant annual leave entitlements:', error);
    }
  });
};

module.exports = { startAnnualLeaveScheduler };
