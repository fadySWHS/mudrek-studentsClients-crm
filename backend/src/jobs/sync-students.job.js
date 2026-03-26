const cron = require('node-cron');
const { syncStudents } = require('../modules/integrations/google-sheets/sheets.service');
const logger = require('../utils/logger');

// Runs every day at 3:00 AM
const startSyncJob = () => {
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running scheduled Google Sheets student sync...');
    try {
      const result = await syncStudents();
      logger.info('Scheduled sync complete', result);
    } catch (err) {
      logger.error('Scheduled sync failed', { error: err.message });
    }
  });
  logger.info('Student sync job scheduled (daily at 3:00 AM)');
};

module.exports = { startSyncJob };
