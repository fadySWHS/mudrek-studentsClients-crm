const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');
const { getSetting } = require('../../utils/getSetting');
const axios = require('axios');
const { google } = require('googleapis');

const prisma = new PrismaClient();

// Default setting definitions — seeded on first GET if not in DB
const DEFAULT_SETTINGS = [
  {
    key: 'DEFAULT_STUDENT_PASSWORD',
    label: 'كلمة المرور الافتراضية للطلاب',
    description: 'كلمة المرور التي سيتم إعطاؤها للطلاب الجدد عند التسجيل أو عند تفعيل حساباتهم',
    sensitive: false,
    value: 'Mudrek@2024',
  },
  {
    key: 'TWOCHAT_API_KEY',
    label: 'مفتاح API لـ 2Chat',
    description: 'مفتاح التفويض لإرسال الرسائل عبر 2Chat WhatsApp',
    sensitive: true,
    value: '',
  },
  {
    key: 'WHATSAPP_GROUP_ID',
    label: 'معرّف مجموعة WhatsApp',
    description: 'رقم أو معرّف المجموعة التي سيتم إرسال الإشعارات إليها',
    sensitive: false,
    value: '',
  },
  {
    key: 'GOOGLE_SHEET_ID',
    label: 'معرّف جدول Google Sheets',
    description: 'الجزء من الرابط: docs.google.com/spreadsheets/d/[SHEET_ID]/edit',
    sensitive: false,
    value: '',
  },
  {
    key: 'GOOGLE_SERVICE_ACCOUNT_JSON',
    label: 'بيانات حساب Google Service Account',
    description: 'محتوى ملف JSON لحساب الخدمة (كامل النص على سطر واحد)',
    sensitive: true,
    value: '',
  },
  {
    key: 'API_WEBHOOK_SECRET',
    label: 'رمز توثيق Webhook (Make.com/Zapier)',
    description: 'الرمز السري الذي يجب إرساله في ترويسة الطلب (Authorization) لمنع أي شخص غير مصرح له من إرسال عملاء إلى النظام. أنشئ جملة أو رقماً معقداً هنا.',
    sensitive: true,
    value: 'REPLACE_WITH_YOUR_SECRET_TOKEN',
  },
  {
    key: 'OPENROUTER_API_KEY',
    label: 'مفتاح API لـ OpenRouter',
    description: 'مفتاح التفويض لاستخدام خدمات الذكاء الاصطناعي من OpenRouter.ai',
    sensitive: true,
    value: '',
  },
];

// Ensure all default keys exist in DB
const ensureDefaults = async () => {
  for (const s of DEFAULT_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},  // don't overwrite existing values
      create: { key: s.key, label: s.label, description: s.description, sensitive: s.sensitive, value: s.value },
    });
  }
};

const getAll = async (req, res) => {
  await ensureDefaults();

  const rows = await prisma.systemSetting.findMany({
    orderBy: { key: 'asc' },
  });

  // Mask sensitive values — show '••••••••' if set
  const safe = rows.map((r) => ({
    key: r.key,
    label: r.label,
    description: r.description,
    sensitive: r.sensitive,
    hasValue: r.value?.trim().length > 0,
    value: r.sensitive
      ? (r.value?.trim() ? '••••••••' : '')
      : r.value,
    updatedAt: r.updatedAt,
  }));

  return success(res, safe);
};

const updateSetting = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) return error(res, 'القيمة مطلوبة', 400);

  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  if (!existing) return error(res, 'الإعداد غير موجود', 404);

  await prisma.systemSetting.update({
    where: { key },
    data: { value: value.trim(), updatedById: req.user.id },
  });

  return success(res, { key }, 'تم تحديث الإعداد بنجاح');
};

// Test 2Chat connection
const testTwochat = async (req, res) => {
  const apiKey = await getSetting('TWOCHAT_API_KEY');
  const groupId = await getSetting('WHATSAPP_GROUP_ID');

  if (!apiKey || !groupId) {
    return error(res, 'يرجى تعيين مفتاح API ومعرّف المجموعة أولاً', 400);
  }

  try {
    await axios.post(
      'https://api.2chat.io/v1/messages/send',
      { to: groupId, message: '✅ اختبار الاتصال من نظام مدرك — تم الاتصال بنجاح!' },
      { 
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 10000 
      }
    );
    return success(res, null, 'تم إرسال رسالة الاختبار بنجاح إلى المجموعة');
  } catch (err) {
    return error(res, `فشل الاتصال بـ 2Chat: ${err.response?.data?.message || err.message}`, 502);
  }
};

// Test Google Sheets connection
const testSheets = async (req, res) => {
  const saJson = await getSetting('GOOGLE_SERVICE_ACCOUNT_JSON');
  const sheetId = await getSetting('GOOGLE_SHEET_ID');

  if (!saJson || !sheetId) {
    return error(res, 'يرجى تعيين بيانات Service Account ومعرّف الجدول أولاً', 400);
  }

  try {
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetTitle = sheetMetadata.data.sheets[0].properties.title;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${sheetTitle}!A1:Q1`,
    });
    const headers = response.data.values?.[0] || [];
    return success(res, { headers }, 'تم الاتصال بـ Google Sheets بنجاح');
  } catch (err) {
    return error(res, `فشل الاتصال بـ Google Sheets: ${err.message}`, 502);
  }
};

// Test Make.com / Zapier Webhook secret
const testWebhook = async (_req, res) => {
  const secret = await getSetting('API_WEBHOOK_SECRET');
  const placeholder = 'REPLACE_WITH_YOUR_SECRET_TOKEN';

  if (!secret || secret.trim() === placeholder) {
    return error(res, 'يرجى تعيين رمز Webhook سري حقيقي أولاً (غير القيمة الافتراضية)', 400);
  }

  // Self-test: hit the webhook endpoint with correct credentials and a dummy payload
  const baseUrl = `http://localhost:${process.env.PORT || 4000}`;
  try {
    await axios.post(
      `${baseUrl}/api/webhooks/make`,
      { name: 'اختبار الاتصال', phone: '0000000000', service: 'Test', source: 'Test', notes: 'رسالة اختبار تلقائية — لا تعالجها' },
      { headers: { Authorization: secret, 'Content-Type': 'application/json' } }
    );
    return success(res, null, 'رمز Webhook صحيح والنقطة تعمل بنجاح ✅');
  } catch (err) {
    return error(res, `فشل اختبار Webhook: ${err.response?.data?.message || err.message}`, 502);
  }
};

module.exports = { getAll, updateSetting, testTwochat, testSheets, testWebhook };
