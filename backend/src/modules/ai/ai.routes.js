const express = require('express');
const { chatStream } = require('./ai.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @desc Generate an AI response stream
 * @route POST /api/ai/chat
 * @access Private
 */
router.post('/chat', protect, chatStream);

module.exports = router;
