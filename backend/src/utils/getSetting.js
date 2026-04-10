/**
 * getSetting(key)
 * Returns the value for a system setting.
 * Priority: DB (system_settings table) > environment variable > undefined
 *
 * This allows admins to override any integration key from the UI
 * without touching the server's .env file.
 */

const { PrismaClient } = require('@prisma/client');
const config = require('../config');

const prisma = new PrismaClient();

// env fallback map: DB key → config property
const ENV_FALLBACK = {
  TWOCHAT_API_KEY:             () => config.twochatApiKey,
  WHATSAPP_GROUP_ID:           () => config.whatsappGroupId,
  GOOGLE_SHEET_ID:             () => config.googleSheetId,
  GOOGLE_SERVICE_ACCOUNT_JSON: () => config.googleServiceAccountJson,
  OPENROUTER_API_KEY:          () => config.openRouterApiKey,
  REPLICATE_API_TOKEN:         () => config.replicateApiToken,
  REPLICATE_STT_MODEL:         () => config.replicateSttModel,
};

const getSetting = async (key) => {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    if (row && row.value && row.value.trim() !== '') return row.value;
  } catch {
    // DB not yet migrated or connection issue — fall through to env
  }
  const fallback = ENV_FALLBACK[key];
  return fallback ? fallback() : undefined;
};

module.exports = { getSetting };
