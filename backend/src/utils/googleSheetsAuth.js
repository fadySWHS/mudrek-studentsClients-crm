const axios = require('axios');
const { google } = require('googleapis');

const GOOGLE_SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

const stripWrappingQuotes = (value) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;

  const wrappedInSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  const wrappedInDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
  return wrappedInSingleQuotes || wrappedInDoubleQuotes ? trimmed.slice(1, -1) : trimmed;
};

const normalizePrivateKey = (privateKey) => {
  if (typeof privateKey !== 'string') return privateKey;

  let normalized = privateKey.replace(/\r\n/g, '\n').trim();
  if (!normalized.includes('\n') && normalized.includes('\\n')) {
    normalized = normalized.replace(/\\n/g, '\n');
  }

  if (normalized && !normalized.endsWith('\n')) {
    normalized += '\n';
  }

  return normalized;
};

const parseGoogleServiceAccountJson = (rawJson) => {
  if (!rawJson || !rawJson.trim()) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON غير مهيأ. أضفه من الإعدادات.');
  }

  let credentials;
  try {
    credentials = JSON.parse(stripWrappingQuotes(rawJson));
  } catch {
    throw new Error('قيمة GOOGLE_SERVICE_ACCOUNT_JSON ليست JSON صالحًا. الصق محتوى ملف JSON بالكامل كما هو.');
  }

  if (!credentials || credentials.type !== 'service_account') {
    throw new Error('قيمة GOOGLE_SERVICE_ACCOUNT_JSON لا تمثل Google Service Account صالحًا.');
  }

  credentials.private_key = normalizePrivateKey(credentials.private_key);

  if (!credentials.client_email || !credentials.private_key || !credentials.token_uri) {
    throw new Error('ملف Google Service Account ينقصه client_email أو private_key أو token_uri.');
  }

  return credentials;
};

const buildGoogleSheetsClient = (credentials) => {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: GOOGLE_SHEETS_SCOPES,
  });

  return google.sheets({ version: 'v4', auth });
};

const decodeUrl = (url) => {
  if (typeof url !== 'string') return url;

  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
};

const findKeyMismatchMessage = async (credentials) => {
  if (!credentials?.private_key_id || !credentials?.client_x509_cert_url) {
    return null;
  }

  try {
    const response = await axios.get(decodeUrl(credentials.client_x509_cert_url), { timeout: 8000 });
    const certMap = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

    if (!certMap || typeof certMap !== 'object' || Array.isArray(certMap)) {
      return null;
    }

    const activeKeyIds = Object.keys(certMap);
    if (activeKeyIds.length > 0 && !activeKeyIds.includes(credentials.private_key_id)) {
      return 'مفتاح Google Service Account الحالي لم يعد نشطًا في Google Cloud. أنشئ مفتاح JSON جديدًا من نفس Service Account ثم حدّث GOOGLE_SERVICE_ACCOUNT_JSON.';
    }
  } catch {
    return null;
  }

  return null;
};

const isInvalidGrant = (err) => {
  const message = String(err?.message || '');
  const errorCode = err?.response?.data?.error;
  const errorDescription = String(err?.response?.data?.error_description || '');

  return message.includes('invalid_grant')
    || errorCode === 'invalid_grant'
    || errorDescription.includes('Invalid JWT Signature');
};

const mapGoogleSheetsError = async (err, credentials) => {
  const message = String(err?.message || '');
  const status = err?.response?.status;

  if (message.includes('DECODER routines') || message.includes('PEM') || message.includes('private key')) {
    return new Error('المفتاح الخاص داخل GOOGLE_SERVICE_ACCOUNT_JSON غير صالح أو تالف. أنشئ ملف JSON جديدًا من Google Cloud والصقه بالكامل.');
  }

  if (isInvalidGrant(err)) {
    const mismatchMessage = await findKeyMismatchMessage(credentials);
    if (mismatchMessage) {
      return new Error(mismatchMessage);
    }

    return new Error('تعذر توثيق Google Service Account. غالبًا ملف JSON قديم، أو private_key غير صالح، أو تم حذف المفتاح من Google Cloud.');
  }

  if (status === 403) {
    return new Error(`تم الوصول إلى Google لكن حساب الخدمة لا يملك صلاحية على الـ Sheet. شارك الجدول مع ${credentials.client_email}.`);
  }

  if (status === 404) {
    return new Error('معرّف Google Sheet غير صحيح أو الجدول غير موجود.');
  }

  return new Error(message || 'فشل الاتصال بـ Google Sheets.');
};

module.exports = {
  buildGoogleSheetsClient,
  mapGoogleSheetsError,
  parseGoogleServiceAccountJson,
};
