const axios = require('axios');
const logger = require('../../../utils/logger');
const { getSetting } = require('../../../utils/getSetting');

const TWOCHAT_BASE = 'https://api.2chat.io/v1';

const sendWhatsAppMessage = async (message) => {
  const apiKey = await getSetting('TWOCHAT_API_KEY');
  const groupId = await getSetting('WHATSAPP_GROUP_ID');

  if (!apiKey || !groupId) {
    logger.warn('2Chat not configured — skipping notification');
    return;
  }

  await axios.post(
    `${TWOCHAT_BASE}/messages/send`,
    { to: groupId, message },
    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
  );
};

module.exports = { sendWhatsAppMessage };
