const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { notifyOverdueReminder } = require('../modules/notifications/notifications.service');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Runs every hour — marks overdue reminders and sends notifications
const startReminderJob = () => {
  cron.schedule('0 * * * *', async () => {
    logger.info('Checking for overdue reminders...');
    try {
      const overdue = await prisma.reminder.findMany({
        where: { status: 'PENDING', dueAt: { lt: new Date() } },
        include: {
          lead: true,
          createdBy: true,
        },
      });

      for (const reminder of overdue) {
        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'OVERDUE' },
        });
        await notifyOverdueReminder(reminder, reminder.lead, reminder.createdBy);
      }

      if (overdue.length > 0) {
        logger.info(`Marked ${overdue.length} reminders as overdue`);
      }
    } catch (err) {
      logger.error('Reminder job failed', { error: err.message });
    }
  });
  logger.info('Reminder check job scheduled (every hour)');
};

module.exports = { startReminderJob };
