const express = require('express');
const { receiveMakeLead } = require('./webhooks.controller');

const router = express.Router();

/**
 * @desc Make.com Lead Ingestion Webhook
 * @route POST /api/webhooks/make
 * @access Public (Requires Token via Header/Query)
 */
router.post('/make', receiveMakeLead);

module.exports = router;
