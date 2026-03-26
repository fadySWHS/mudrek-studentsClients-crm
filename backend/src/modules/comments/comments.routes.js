const express = require('express');
const { addComment, deleteComment } = require('./comments.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router({ mergeParams: true });

router.use(authenticate);
router.post('/', addComment);
router.delete('/:commentId', deleteComment);

module.exports = router;
