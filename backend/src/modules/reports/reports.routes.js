const express = require('express');
const { getDashboardStats, getStudentPerformance, getLostReasons } = require('./reports.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/students', getStudentPerformance);
router.get('/lost-reasons', getLostReasons);

module.exports = router;
