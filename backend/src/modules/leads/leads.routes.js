const express = require('express');
const multer = require('multer');
const os = require('os');
const {
  getAll,
  getClaimPolicy,
  listPendingReleaseRequests,
  getOne,
  create,
  update,
  claimLead,
  deleteLead,
  requestLeadRelease,
  reviewLeadReleaseRequest,
  addLeadCallRecord,
} = require('./leads.controller');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

router.use(authenticate);

router.get('/', getAll);
router.get('/claim-policy', getClaimPolicy);
router.get('/release-requests/pending', requireAdmin, listPendingReleaseRequests);
router.get('/:id', getOne);
router.post('/', requireAdmin, create);
router.put('/:id', update);
router.patch('/:id/claim', claimLead);
router.post('/:id/release-requests', requestLeadRelease);
router.patch('/:id/release-requests/:requestId', requireAdmin, reviewLeadReleaseRequest);
router.post('/:id/call-records', upload.single('audio'), addLeadCallRecord);
router.delete('/:id', requireAdmin, deleteLead);

module.exports = router;
