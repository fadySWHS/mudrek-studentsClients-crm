const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');
const { getSetting } = require('../../utils/getSetting');
const {
  DEFAULT_ACTIVE_LEAD_LIMIT_KEY,
  DEFAULT_BLOCK_AFTER_WON_KEY,
} = require('../../utils/studentLeadPolicy');
const { testTwochatConnection } = require('../integrations/twochat/twochat.service');
const axios = require('axios');
const { google } = require('googleapis');

const prisma = new PrismaClient();

const isOpenRouterKey = (value) => typeof value === 'string' && value.trim().startsWith('sk-or-v1');

const DEFAULT_SETTINGS = [
  {
    key: 'DEFAULT_STUDENT_PASSWORD',
    label: 'كلمة المرور الافتراضية للطلاب',
    description: 'كلمة المرور التي سيحصل عليها الطلاب الجدد عند إنشاء الحساب أو إعادة التفعيل.',
    sensitive: false,
    value: 'Mudrek@2024',
  },
  {
    key: DEFAULT_ACTIVE_LEAD_LIMIT_KEY,
    label: 'الحد الافتراضي لحجز العملاء للطلاب',
    description: 'عدد العملاء النشطين المسموح به لكل طالب في نفس الوقت. اجعل القيمة 0 إذا كنت لا تريد وضع حد افتراضي.',
    sensitive: false,
    value: '0',
  },
  {
    key: DEFAULT_BLOCK_AFTER_WON_KEY,
    label: 'إيقاف حجز العملاء الجدد بعد صفقة ناجحة',
    description: 'إذا كانت القيمة true فسيتم منع الطالب من أخذ عملاء جدد بعد أول عميل بحالة مغلق - ناجح، مع بقاء أدوات التدريب متاحة.',
    sensitive: false,
    value: 'false',
  },
  {
    key: 'TWOCHAT_API_KEY',
    label: 'مفتاح API لـ 2Chat',
    description: 'مفتاح التفويض المستخدم لإرسال رسائل WhatsApp عبر 2Chat.',
    sensitive: true,
    value: '',
  },
  {
    key: 'TWOCHAT_SOURCE_NUMBER',
    label: 'رقم الإرسال في 2Chat',
    description: 'اختياري. اكتب رقم WhatsApp المتصل بصيغة دولية مثل +201234567890 إذا كان لديك أكثر من رقم داخل 2Chat.',
    sensitive: false,
    value: '',
  },
  {
    key: 'WHATSAPP_GROUP_ID',
    label: 'معرّف مجموعة WhatsApp',
    description: 'المجموعة التي ستستقبل الإشعارات. يمكن إدخال UUID الخاص بالمجموعة من 2Chat أو معرّف WhatsApp الذي ينتهي بـ @g.us.',
    sensitive: false,
    value: '',
  },
  {
    key: 'GOOGLE_SHEET_ID',
    label: 'معرّف Google Sheets',
    description: 'الجزء الموجود داخل رابط الجدول بين /d/ و /edit.',
    sensitive: false,
    value: '',
  },
  {
    key: 'GOOGLE_SERVICE_ACCOUNT_JSON',
    label: 'بيانات Google Service Account',
    description: 'محتوى ملف JSON الخاص بحساب الخدمة بالكامل في سطر واحد.',
    sensitive: true,
    value: '',
  },
  {
    key: 'API_WEBHOOK_SECRET',
    label: 'رمز Webhook السري',
    description: 'القيمة التي يجب إرسالها في ترويسة Authorization لحماية Webhook.',
    sensitive: true,
    value: 'REPLACE_WITH_YOUR_SECRET_TOKEN',
  },
  {
    key: 'OPENROUTER_API_KEY',
    label: 'مفتاح OpenRouter',
    description: 'مطلوب للمحادثة وتحليل المكالمات، ويمكن استخدامه أيضاً لتفريغ الصوت عند غياب Replicate.',
    sensitive: true,
    value: '',
  },
  {
    key: 'OPENAI_REALTIME_API_KEY',
    label: 'مفتاح OpenAI Realtime',
    description: 'مطلوب لتشغيل المكالمات الصوتية المباشرة داخل المتصفح وبناء جلسات WebRTC الحية.',
    sensitive: true,
    value: '',
  },
  {
    key: 'REPLICATE_API_TOKEN',
    label: 'مفتاح Replicate',
    description: 'مفضل لتحويل الصوت إلى نص قبل تحليل المكالمة.',
    sensitive: true,
    value: '',
  },
  {
    key: 'REPLICATE_STT_MODEL',
    label: 'نموذج Replicate للتفريغ',
    description: 'اختياري. اتركه على whisper ما لم تكن تستخدم نموذجاً آخر متوافقاً على Replicate.',
    sensitive: false,
    value: 'whisper',
  },
];

const ensureDefaults = async () => {
  for (const setting of DEFAULT_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {
        label: setting.label,
        description: setting.description,
        sensitive: setting.sensitive,
      },
      create: {
        key: setting.key,
        label: setting.label,
        description: setting.description,
        sensitive: setting.sensitive,
        value: setting.value,
      },
    });
  }
};

const migrateLegacyAiSettings = async () => {
  const [openRouterSetting, realtimeSetting, legacyOpenAiSetting, replicateModelSetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'OPENROUTER_API_KEY' } }),
    prisma.systemSetting.findUnique({ where: { key: 'OPENAI_REALTIME_API_KEY' } }),
    prisma.systemSetting.findUnique({ where: { key: 'OPENAI_API_KEY' } }),
    prisma.systemSetting.findUnique({ where: { key: 'REPLICATE_STT_MODEL' } }),
  ]);

  if (!legacyOpenAiSetting) return;

  const openRouterValue = openRouterSetting?.value?.trim() || '';
  const realtimeValue = realtimeSetting?.value?.trim() || '';
  const legacyValue = legacyOpenAiSetting.value?.trim() || '';

  if (!openRouterValue && isOpenRouterKey(legacyValue)) {
    await prisma.systemSetting.update({
      where: { key: 'OPENROUTER_API_KEY' },
      data: { value: legacyValue },
    });
  }

  if (!realtimeValue && legacyValue && !isOpenRouterKey(legacyValue)) {
    await prisma.systemSetting.update({
      where: { key: 'OPENAI_REALTIME_API_KEY' },
      data: { value: legacyValue },
    });
  }

  if (replicateModelSetting?.value?.trim() === 'openai/whisper') {
    await prisma.systemSetting.update({
      where: { key: 'REPLICATE_STT_MODEL' },
      data: { value: 'whisper' },
    });
  }

  await prisma.systemSetting.delete({ where: { key: 'OPENAI_API_KEY' } });
};

const getAll = async (_req, res) => {
  await ensureDefaults();
  await migrateLegacyAiSettings();

  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        not: 'OPENAI_API_KEY',
      },
    },
    orderBy: { key: 'asc' },
  });

  const safe = rows.map((row) => ({
    key: row.key,
    label: row.label,
    description: row.description,
    sensitive: row.sensitive,
    hasValue: row.value?.trim().length > 0,
    value: row.sensitive ? (row.value?.trim() ? '********' : '') : row.value,
    updatedAt: row.updatedAt,
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

const testTwochat = async (_req, res) => {
  const apiKey = await getSetting('TWOCHAT_API_KEY');
  const groupId = await getSetting('WHATSAPP_GROUP_ID');

  if (!apiKey || !groupId) {
    return error(res, 'يرجى تعيين مفتاح 2Chat ومعرّف المجموعة أولاً', 400);
  }

  try {
    const target = await testTwochatConnection('تم اختبار الاتصال من نظام مدرك بنجاح.');
    return success(
      res,
      target,
      'تم إرسال رسالة الاختبار إلى المجموعة بنجاح عبر 2Chat'
    );
  } catch (err) {
    return error(res, err.message || 'فشل الاتصال بـ 2Chat', err.statusCode || 502);
  }
};

const testSheets = async (_req, res) => {
  const saJson = await getSetting('GOOGLE_SERVICE_ACCOUNT_JSON');
  const sheetId = await getSetting('GOOGLE_SHEET_ID');

  if (!saJson || !sheetId) {
    return error(res, 'يرجى تعيين بيانات خدمة Google ومعرّف الجدول أولاً', 400);
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

const testWebhook = async (_req, res) => {
  const secret = await getSetting('API_WEBHOOK_SECRET');
  const placeholder = 'REPLACE_WITH_YOUR_SECRET_TOKEN';

  if (!secret || secret.trim() === placeholder) {
    return error(res, 'يرجى تعيين رمز Webhook سري حقيقي أولاً', 400);
  }

  const baseUrl = `http://localhost:${process.env.PORT || 4000}`;

  try {
    await axios.post(
      `${baseUrl}/api/webhooks/make`,
      {
        name: 'اختبار الاتصال',
        phone: '0000000000',
        service: 'Test',
        source: 'Test',
        notes: 'رسالة اختبار تلقائية - لا تعالجها',
      },
      { headers: { Authorization: secret, 'Content-Type': 'application/json' } }
    );

    return success(res, null, 'رمز Webhook صحيح والنقطة تعمل بنجاح');
  } catch (err) {
    return error(res, `فشل اختبار Webhook: ${err.response?.data?.message || err.message}`, 502);
  }
};

module.exports = { getAll, updateSetting, testTwochat, testSheets, testWebhook };
