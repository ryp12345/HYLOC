const cron = require('node-cron');
const { grantAnnualEntitlementsForYear } = require('../services/leaveEntitlement.service');

//const CRON_EXPRESSION = '45 18 31 1 *'; // Jan 31st at 6:45 PM (min hr dom mon dow)
//const CRON_EXPRESSION = '00 00 00 01 01 *';    1 Jan at 00:00 (start of new year)
//const CRON_EXPRESSION = '02 12 12 5 *'; // Feb 4th at 12:01 PM (min hr dom mon dow)

const CRON_EXPRESSION = '27 16 2 6 *';  // June 2nd at 10:36 AM

const startAnnualLeaveScheduler = () => {
  cron.schedule(CRON_EXPRESSION, async () => {
    // scheduler runs during current year but should grant entitlements for the coming year
    const year = new Date().getFullYear() + 1;
    try {
      const inserted = await grantAnnualEntitlementsForYear(year);
      console.log(`Annual leave entitlements granted for year ${year}. Inserted: ${inserted}`);
    } catch (error) {
      console.error('Failed to grant annual leave entitlements:', error);
    }
  });
};

module.exports = { startAnnualLeaveScheduler };
