require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  googleSheetId: process.env.GOOGLE_SHEET_ID,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  replicateApiToken: process.env.REPLICATE_API_TOKEN,
  replicateSttModel: process.env.REPLICATE_STT_MODEL,
  twochatApiKey: process.env.TWOCHAT_API_KEY,
  whatsappGroupId: process.env.WHATSAPP_GROUP_ID,
  appBaseUrl: process.env.APP_BASE_URL,
};
