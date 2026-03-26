const express = require('express');
const { getAll, getOne, create, update, claimLead, deleteLead } = require('./leads.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', requireAdmin, create);
router.put('/:id', update);
router.patch('/:id/claim', claimLead);
router.delete('/:id', requireAdmin, deleteLead);

module.exports = router;
