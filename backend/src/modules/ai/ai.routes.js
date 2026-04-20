const express = require('express');
const multer = require('multer');
const os = require('os');
const {
  chatStream,
  analyzeCall,
  reviewProposal,
  getVoiceAvailability,
  getCallAnalyses,
  createPracticeSession,
  practiceChat,
  listVoiceJourneys,
  createVoiceJourney,
  startVoiceJourneyCall,
  createVoiceJourneySession,
  completeVoiceJourneyCall,
} = require('./ai.controller');
const {
  getLeadConversation,
  streamLeadConversation,
} = require('./lead-assistant.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

/**
 * @desc Get the persisted AI conversation for a lead
 * @route GET /api/ai/leads/:leadId/conversation
 * @access Private
 */
router.get('/leads/:leadId/conversation', authenticate, getLeadConversation);

/**
 * @desc Continue the persisted AI conversation for a lead
 * @route POST /api/ai/leads/:leadId/chat
 * @access Private
 */
router.post('/leads/:leadId/chat', authenticate, streamLeadConversation);

/**
 * @desc Generate an AI response stream
 * @route POST /api/ai/chat
 * @access Private
 */
router.post('/chat', authenticate, chatStream);

/**
 * @desc Generate a random AI roleplay client session
 * @route POST /api/ai/practice-session
 * @access Private
 */
router.post('/practice-session', authenticate, createPracticeSession);

/**
 * @desc Continue an AI roleplay client chat
 * @route POST /api/ai/practice-chat
 * @access Private
 */
router.post('/practice-chat', authenticate, practiceChat);

/**
 * @desc Check whether voice practice is enabled
 * @route GET /api/ai/voice-availability
 * @access Private
 */
router.get('/voice-availability', authenticate, getVoiceAvailability);

/**
 * @desc List persisted voice-practice client journeys
 * @route GET /api/ai/voice-journeys
 * @access Private
 */
router.get('/voice-journeys', authenticate, listVoiceJourneys);

/**
 * @desc Create a new persistent voice-practice client journey
 * @route POST /api/ai/voice-journeys
 * @access Private
 */
router.post('/voice-journeys', authenticate, createVoiceJourney);

/**
 * @desc Start a new staged voice-practice call
 * @route POST /api/ai/voice-journeys/:journeyId/calls/start
 * @access Private
 */
router.post('/voice-journeys/:journeyId/calls/start', authenticate, startVoiceJourneyCall);

/**
 * @desc Create a WebRTC realtime session for a staged voice-practice call
 * @route POST /api/ai/voice-journeys/:journeyId/calls/:callId/session
 * @access Private
 */
router.post(
  '/voice-journeys/:journeyId/calls/:callId/session',
  authenticate,
  express.text({ type: ['application/sdp', 'text/plain'] }),
  createVoiceJourneySession
);

/**
 * @desc Complete a staged voice-practice call and review it
 * @route POST /api/ai/voice-journeys/:journeyId/calls/:callId/complete
 * @access Private
 */
router.post('/voice-journeys/:journeyId/calls/:callId/complete', authenticate, completeVoiceJourneyCall);

/**
 * @desc Upload a proposal document and get AI review feedback
 * @route POST /api/ai/review-proposal
 * @access Private
 */
router.post('/review-proposal', authenticate, upload.single('proposal'), reviewProposal);

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
