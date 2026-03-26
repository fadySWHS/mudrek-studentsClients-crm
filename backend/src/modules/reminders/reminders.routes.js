const express = require('express');
const { getMyReminders, create, markDone } = require('./reminders.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

// GET /reminders - get all my reminders
router.get('/', getMyReminders);
// POST /leads/:leadId/reminders - create reminder for a lead
router.post('/', create);
// PATCH /reminders/:id/done
router.patch('/:id/done', markDone);

module.exports = router;
