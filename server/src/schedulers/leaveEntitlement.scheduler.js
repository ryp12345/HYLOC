const cron = require('node-cron');
const { grantAnnualEntitlementsForYear } = require('../services/leaveEntitlement.service');

//const CRON_EXPRESSION = '45 18 31 1 *'; // Jan 31st at 6:45 PM(mins hrs dd mm yyyy)
const CRON_EXPRESSION = '56 13 4 2 *'; // Feb 4th at 12:01PM

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
