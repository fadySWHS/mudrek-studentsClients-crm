const express = require('express');
const multer = require('multer');
const os = require('os');
const { chatStream, analyzeCall, getCallAnalyses } = require('./ai.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

/**
 * @desc Generate an AI response stream
 * @route POST /api/ai/chat
 * @access Private
 */
router.post('/chat', authenticate, chatStream);

/**
 * @desc Get User's past AI sales analyses
 * @route GET /api/ai/analyze-call
 * @access Private
 */
router.get('/analyze-call', authenticate, getCallAnalyses);

/**
 * @desc Upload audio and get AI sales analysis
 * @route POST /api/ai/analyze-call
 * @access Private
 */
router.post('/analyze-call', authenticate, upload.single('audio'), analyzeCall);

module.exports = router;
