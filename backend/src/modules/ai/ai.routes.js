const express = require('express');
const { chatStream } = require('./ai.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router();

/**
 * @desc Generate an AI response stream
 * @route POST /api/ai/chat
 * @access Private
 */
router.post('/chat', authenticate, chatStream);

module.exports = router;
