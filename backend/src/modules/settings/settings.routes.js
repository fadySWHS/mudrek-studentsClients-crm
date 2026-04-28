const express = require('express');
const { getAll, updateSetting, resetStudentLeadLimitOverrides, testTwochat, testSheets, testWebhook } = require('./settings.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', getAll);
router.put('/:key', updateSetting);
router.post('/actions/reset-student-lead-limit-overrides', resetStudentLeadLimitOverrides);
router.post('/test/twochat', testTwochat);
router.post('/test/sheets', testSheets);
router.post('/test/webhook', testWebhook);

module.exports = router;
