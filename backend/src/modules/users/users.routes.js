const express = require('express');
const { getAll, getOne, create, update, toggleActive } = require('./users.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/toggle-active', toggleActive);

module.exports = router;
