const axios = require('axios');
const logger = require('../../../utils/logger');
const { getSetting } = require('../../../utils/getSetting');

const TWOCHAT_BASE = 'https://api.p.2chat.io/open';

const createTwochatError = (message, statusCode = 502) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const normalizePhoneNumber = (value) => {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;

  const digits = trimmed.replace(/[^\d]/g, '');
  return digits ? `+${digits}` : trimmed;
};

const getTwochatClient = (apiKey) =>
  axios.create({
    baseURL: TWOCHAT_BASE,
    headers: {
      'X-User-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });

const parseTwochatError = (err, fallbackMessage = 'فشل الاتصال بـ 2Chat') => {
  const statusCode = err?.response?.status || err?.statusCode || 502;
  const responseData = err?.response?.data;

  if (typeof responseData === 'object' && responseData !== null) {
    const details = responseData.message || responseData.error;
    if (details) return createTwochatError(`${fallbackMessage}: ${details}`, statusCode);
  }

  if (typeof responseData === 'string' && responseData.trim()) {
    const normalized = responseData
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);

    const details = normalized || 'استجابة غير قابلة للقراءة من خادم 2Chat';
    return createTwochatError(`${fallbackMessage}: ${details}`, statusCode);
  }

  return createTwochatError(`${fallbackMessage}: ${err.message}`, statusCode);
};

const listConnectedNumbers = async (client) => {
  const response = await client.get('/whatsapp/get-numbers', {
    params: {
      page_number: 0,
      results_per_page: 100,
      status: 'connected',
    },
  });

  const numbers = Array.isArray(response.data?.numbers)
    ? response.data.numbers
    : Array.isArray(response.data?.data)
      ? response.data.data
      : [];

  return numbers.filter((entry) => {
    const status = String(entry.connection_status || '').toLowerCase();
    return entry.phone_number && (status === 'c' || status === 'connected' || entry.enabled !== false);
  });
};

const resolveSourceNumber = async (client) => {
  const configured = normalizePhoneNumber(await getSetting('TWOCHAT_SOURCE_NUMBER'));
  if (configured) return configured;

  const connectedNumbers = await listConnectedNumbers(client);

  if (connectedNumbers.length === 1) {
    return connectedNumbers[0].phone_number;
  }

  if (connectedNumbers.length === 0) {
    throw createTwochatError('لا يوجد رقم WhatsApp متصل بحساب 2Chat. اربط رقماً أولاً من لوحة 2Chat.', 400);
  }

  throw createTwochatError(
    'يوجد أكثر من رقم متصل على 2Chat. حدّد رقم الإرسال في الإعداد TWOCHAT_SOURCE_NUMBER.',
    400
  );
};

const listGroups = async (client, sourceNumber) => {
  const response = await client.get(`/whatsapp/groups/${encodeURIComponent(sourceNumber)}`);
  return Array.isArray(response.data?.data) ? response.data.data : [];
};

const resolveGroupUuid = async (client, sourceNumber) => {
  const configuredGroupId = String((await getSetting('WHATSAPP_GROUP_ID')) || '').trim();
  if (!configuredGroupId) {
    throw createTwochatError('يرجى تعيين معرّف مجموعة WhatsApp أولاً.', 400);
  }

  if (configuredGroupId.startsWith('WAG')) {
    return configuredGroupId;
  }

  const groups = await listGroups(client, sourceNumber);
  const targetGroup = groups.find(
    (group) => group.uuid === configuredGroupId || group.wa_group_id === configuredGroupId
  );

  if (!targetGroup?.uuid) {
    throw createTwochatError(
      'تعذر العثور على المجموعة المحددة داخل 2Chat. استخدم UUID للمجموعة أو تأكد أن الرقم المتصل عضو فيها.',
      400
    );
  }

  return targetGroup.uuid;
};

const resolveMessageTarget = async () => {
  const apiKey = String((await getSetting('TWOCHAT_API_KEY')) || '').trim();
  if (!apiKey) {
    throw createTwochatError('يرجى تعيين مفتاح 2Chat أولاً.', 400);
  }

  const client = getTwochatClient(apiKey);

  try {
    const sourceNumber = await resolveSourceNumber(client);
    const groupUuid = await resolveGroupUuid(client, sourceNumber);

    return { client, sourceNumber, groupUuid };
  } catch (err) {
    throw parseTwochatError(err, 'تعذر تهيئة الاتصال مع 2Chat');
  }
};

const sendWhatsAppMessage = async (message) => {
  if (!message || !String(message).trim()) {
    throw createTwochatError('لا يمكن إرسال رسالة فارغة إلى 2Chat.', 400);
  }

  const hasApiKey = String((await getSetting('TWOCHAT_API_KEY')) || '').trim();
  const hasGroup = String((await getSetting('WHATSAPP_GROUP_ID')) || '').trim();

  if (!hasApiKey || !hasGroup) {
    logger.warn('2Chat not configured - skipping notification');
    return;
  }

  const { client, sourceNumber, groupUuid } = await resolveMessageTarget();

  try {
    await client.post('/whatsapp/send-message', {
      from_number: sourceNumber,
      to_group_uuid: groupUuid,
      text: String(message).trim(),
    });
  } catch (err) {
    throw parseTwochatError(err);
  }
};

const testTwochatConnection = async (message) => {
  const { sourceNumber, groupUuid } = await resolveMessageTarget();
  await sendWhatsAppMessage(message);
  return { sourceNumber, groupUuid };
};

module.exports = { sendWhatsAppMessage, testTwochatConnection };
