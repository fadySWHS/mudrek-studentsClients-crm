const { google } = require('googleapis');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const config = require('../../../config');
const logger = require('../../../utils/logger');

const prisma = new PrismaClient();

const getSheetClient = () => {
  const credentials = JSON.parse(config.googleServiceAccountJson);
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
  const sheets = getSheetClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetId,
    range: 'Sheet1!A2:E',
  });

  const rows = response.data.values || [];
  const results = { created: 0, updated: 0, disabled: 0, errors: [] };

  for (const row of rows) {
    const [name, email, role, activeRaw, studentId] = row;
    if (!email) continue;

    const active = activeRaw?.toUpperCase() === 'TRUE';
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
        const defaultPassword = await bcrypt.hash('Mudrek@2024', 10);
        await prisma.user.create({
          data: { name, email, password: defaultPassword, role: userRole, active, sourceStudentId: studentId },
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
