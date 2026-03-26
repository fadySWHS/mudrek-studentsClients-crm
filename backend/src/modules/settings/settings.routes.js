const express = require('express');
const { getAll, updateSetting, testTwochat, testSheets } = require('./settings.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', getAll);
router.put('/:key', updateSetting);
router.post('/test/twochat', testTwochat);
router.post('/test/sheets', testSheets);

module.exports = router;
