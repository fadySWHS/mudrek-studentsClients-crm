const express = require('express');
const { syncStudents } = require('./google-sheets/sheets.service');
const { success, error } = require('../../utils/response');
const { authenticate, requireAdmin } = require('../../middleware/auth.middleware');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();
router.use(authenticate, requireAdmin);

router.post('/sync-students', async (req, res) => {
  try {
    const result = await syncStudents();
    return success(res, result, 'تم المزامنة مع Google Sheets بنجاح');
  } catch (err) {
    return error(res, `فشل المزامنة: ${err.message}`, 500);
  }
});

router.get('/sync-logs', async (req, res) => {
  const logs = await prisma.syncLog.findMany({
    orderBy: { syncedAt: 'desc' },
    take: 20,
  });
  return success(res, logs);
});

module.exports = router;
