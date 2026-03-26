require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { error } = require('./src/utils/response');

// Routes
const authRoutes = require('./src/modules/auth/auth.routes');
const usersRoutes = require('./src/modules/users/users.routes');
const leadsRoutes = require('./src/modules/leads/leads.routes');
const commentsRoutes = require('./src/modules/comments/comments.routes');
const remindersRoutes = require('./src/modules/reminders/reminders.routes');
const activityRoutes = require('./src/modules/activity-log/activity.routes');
const reportsRoutes = require('./src/modules/reports/reports.routes');
const integrationsRoutes = require('./src/modules/integrations/integrations.routes');

// Jobs
const { startSyncJob } = require('./src/jobs/sync-students.job');
const { startReminderJob } = require('./src/jobs/due-reminders.job');

const app = express();

// Security & middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/leads/:leadId/comments', commentsRoutes);
app.use('/api/leads/:leadId/reminders', remindersRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/integrations', integrationsRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', env: config.nodeEnv }));

// 404 handler
app.use((req, res) => error(res, 'المسار غير موجود', 404));

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  error(res, 'خطأ داخلي في الخادم', 500);
});

// Start background jobs (only in production to avoid dev noise)
if (config.nodeEnv === 'production') {
  startSyncJob();
  startReminderJob();
}

const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Mudrek Backend running on port ${PORT} [${config.nodeEnv}]`);
});

module.exports = app;
