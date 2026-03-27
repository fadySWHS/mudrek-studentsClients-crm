const express = require('express');
const { getAll, getOne, create, update, toggleActive, deleteUser, bulkToggleActive, bulkDelete } = require('./users.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate, requireAdmin);

router.get('/', getAll);           // ?role=STUDENT|ADMIN
router.post('/', create);

// Bulk routes must precede /:id to prevent matching "bulk" as an ID
router.patch('/bulk/toggle-active', bulkToggleActive);
router.post('/bulk/delete', bulkDelete); // using POST for sending JSON body comfortably 

router.get('/:id', getOne);
router.put('/:id', update);
router.patch('/:id/toggle-active', toggleActive);
router.delete('/:id', deleteUser);

module.exports = router;
