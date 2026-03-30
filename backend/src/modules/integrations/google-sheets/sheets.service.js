const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const logger = require('../../../utils/logger');
const { getSetting } = require('../../../utils/getSetting');

const prisma = new PrismaClient();

const getSheetClient = async () => {
  const saJson = await getSetting('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON غير مهيّأ. أضفه من الإعدادات.');
  const credentials = JSON.parse(saJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
};

/**
 * Expected sheet columns: name, email, role, active (TRUE/FALSE), studentId
 * Row 1 = headers, data starts from row 2
 */
const syncStudents = async () => {
  const sheetId = await getSetting('GOOGLE_SHEET_ID');
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID غير مهيّأ. أضفه من الإعدادات.');

  const defaultUserPass = await getSetting('DEFAULT_STUDENT_PASSWORD') || 'Mudrek@2024';
  const hashedDefaultPass = await bcrypt.hash(defaultUserPass, 10);

  const sheets = await getSheetClient();
  const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetTitle = sheetMetadata.data.sheets[0].properties.title;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetTitle}!A2:Q`,
  });

  const rows = response.data.values || [];
  const results = { created: 0, updated: 0, disabled: 0, errors: [] };

  for (const row of rows) {
    const firstName = row[0] || '';
    const lastName = row[1] || '';
    const name = `${firstName} ${lastName}`.trim();
    const role = row[2];
    const email = row[3];
    const studentId = row[4];
    const statusVal = row[16] || '';

    if (!email) continue;

    const active = statusVal.trim().toLowerCase() !== 'stopped';
    const userRole = role?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STUDENT';

    try {
      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        await prisma.user.update({
          where: { email },
          data: { name: name || existing.name, role: userRole, active, sourceStudentId: studentId },
        });
        results.updated++;
        if (!active) results.disabled++;
      } else {
        await prisma.user.create({
          data: { name, email, password: hashedDefaultPass, role: userRole, active, sourceStudentId: studentId },
        });
        results.created++;
      }
    } catch (err) {
      results.errors.push({ email, error: err.message });
      logger.error('Sync error for student', { email, error: err.message });
    }
  }

  await prisma.syncLog.create({
    data: { syncType: 'GOOGLE_SHEETS', result: JSON.stringify(results) },
  });

  logger.info('Google Sheets sync complete', results);
  return results;
};

module.exports = { syncStudents };
