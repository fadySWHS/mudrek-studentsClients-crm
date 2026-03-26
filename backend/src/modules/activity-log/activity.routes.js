const express = require('express');
const { getLog } = require('./activity.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();
router.get('/', authenticate, requireAdmin, getLog);

module.exports = router;
