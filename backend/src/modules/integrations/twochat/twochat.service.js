const axios = require('axios');
const config = require('../../../config');
const logger = require('../../../utils/logger');

const TWOCHAT_BASE = 'https://api.2chat.io/v1';

const sendWhatsAppMessage = async (message) => {
  if (!config.twochatApiKey || !config.whatsappGroupId) {
    logger.warn('2Chat not configured — skipping notification');
    return;
  }

  await axios.post(
    `${TWOCHAT_BASE}/messages/send`,
    {
      to: config.whatsappGroupId,
      message,
    },
    {
      headers: {
        Authorization: `Bearer ${config.twochatApiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
};

module.exports = { sendWhatsAppMessage };
