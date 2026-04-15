const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');
const { PrismaClient } = require('@prisma/client');
const { OpenAI } = require('openai');
const { getSetting } = require('../../utils/getSetting');
const { error } = require('../../utils/response');

const prisma = new PrismaClient();

const DEFAULT_OPENROUTER_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o-mini';
const DEFAULT_OPENROUTER_AUDIO_MODEL = process.env.OPENROUTER_AUDIO_MODEL || 'openai/gpt-audio-mini';
const DEFAULT_OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
const DEFAULT_OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-mini';
const DEFAULT_OPENAI_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || 'marin';
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';
const DEFAULT_REPLICATE_STT_MODEL = process.env.REPLICATE_STT_MODEL || 'whisper';
const REPLICATE_TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'canceled']);
const REPLICATE_MODEL_ALIASES = {
  whisper: 'openai/whisper',
};
const PRACTICE_LOCATIONS = ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة', 'طنطا', 'دبي', 'الرياض', 'جدة', 'عمّان'];
const PRACTICE_INDUSTRIES = [
  'عيادة أسنان',
  'مكتب عقارات',
  'براند ملابس محلي',
  'مطعم ومطبخ سحابي',
  'مركز تجميل',
  'أكاديمية تدريب أونلاين',
  'شركة شحن محلية',
  'معرض أثاث',
  'شركة تشطيبات وديكور',
  'ورشة سيارات',
];
const PRACTICE_SERVICES = [
  'إدارة السوشيال ميديا',
  'تصميم موقع تعريفي أو متجر إلكتروني',
  'تشغيل إعلانات ممولة',
  'هوية بصرية وبراندنج',
  'إعداد CRM ومتابعة العملاء',
  'كتابة محتوى وتصوير قصير',
  'تحسين الظهور على خرائط Google و SEO',
  'أتمتة واتساب والردود السريعة',
];
const PRACTICE_PERSONALITIES = [
  'مباشر وصبور لكنه عملي جداً',
  'ودود ويحب الكلام لكنه متردد',
  'مشغول ويحب الإجابات السريعة',
  'تحليلي ويطلب أرقاماً واضحة',
  'متحفظ ويخاف من المخاطرة',
  'حماسي لكنه غير منظم',
  'متشكك بسبب تجربة سابقة سيئة',
  'يحب المقارنة بين أكثر من مزود خدمة',
];
const PRACTICE_OBJECTION_ANGLES = [
  'يعترض على السعر',
  'غير مقتنع أن الخدمة ستجيب نتيجة',
  'يخاف من الالتزام بعقد طويل',
  'يرى أن الفريق الداخلي يمكنه تنفيذ المطلوب',
  'يعتقد أن التوقيت غير مناسب الآن',
  'قلق من قياس العائد على الاستثمار',
  'متأثر بتجربة فاشلة مع وكالة سابقة',
];
const PRACTICE_DIFFICULTIES = ['سهل', 'متوسط', 'صعب'];
const PRACTICE_BUDGETS = ['منخفضة', 'متوسطة', 'مرنة لكن مشروطة بنتائج', 'مرتفعة نسبياً مع توقعات عالية'];
const PRACTICE_DIGITAL_MATURITY = ['مبتدئ رقمياً', 'عنده حضور بسيط', 'نشط لكنه غير منظم', 'يملك فريقاً صغيراً وتسويقاً متقطعاً'];
const PRACTICE_COMPANY_SIZES = ['فردي', 'فريق صغير', 'شركة متوسطة', 'براند عنده أكثر من فرع'];
const PRACTICE_SCENARIO_TYPES = ['inbound', 'outbound'];
const PRACTICE_OUTREACH_CHANNELS = ['واتساب', 'رسالة إنستغرام', 'بريد إلكتروني', 'لينكدإن', 'مكالمة أولية'];
const PRACTICE_LEAD_TEMPERATURES = ['بارد', 'دافئ', 'ساخن نسبياً'];
const PRACTICE_ARABIC_DIALECTS = ['عربي مصري', 'عربي شامي', 'عربي فلسطيني', 'عربي خليجي'];
const PRACTICE_SESSION_TTL_MS = 45 * 60 * 1000;
const PROPOSAL_REVIEW_TEXT_LIMIT = 30000;
const VOICE_JOURNEY_STAGES = [
  'FIRST_OUTREACH',
  'DISCOVERY_CALL',
  'QUALIFICATION_CALL',
  'OFFER_CALL',
  'FOLLOW_UP_CALL',
  'CLOSING_CALL',
];
const VOICE_JOURNEY_STAGE_META = {
  FIRST_OUTREACH: {
    label: 'أول اتصال',
    objectives: ['كسر الجليد باحتراف', 'أخذ إذن لإكمال الحوار', 'خلق سبب واضح لمكالمة اكتشاف'],
  },
  DISCOVERY_CALL: {
    label: 'مكالمة اكتشاف',
    objectives: ['فهم الاحتياج الحقيقي', 'معرفة طريقة جذب العملاء الحالية', 'كشف التوقيت وصاحب القرار'],
  },
  QUALIFICATION_CALL: {
    label: 'مكالمة تأهيل',
    objectives: ['تأكيد الملاءمة', 'قياس الجدية والميزانية', 'تحديد المطلوب قبل العرض'],
  },
  OFFER_CALL: {
    label: 'مكالمة عرض',
    objectives: ['ربط العرض بالمشكلة', 'شرح النتائج والخطوات', 'معالجة السعر والاعتراضات'],
  },
  FOLLOW_UP_CALL: {
    label: 'مكالمة متابعة',
    objectives: ['إزالة التردد', 'توضيح النقاط المعلقة', 'تقريب القرار للخطوة التالية'],
  },
  CLOSING_CALL: {
    label: 'مكالمة حسم',
    objectives: ['تأكيد القرار النهائي', 'إغلاق الصفقة أو كشف سبب التعثر', 'الاتفاق على التنفيذ أو المتابعة الأخيرة'],
  },
};
const practiceSessionStore = new Map();
const wordExtractor = new WordExtractor();

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');
const isOpenRouterKey = (value) => normalize(value).startsWith('sk-or-v1');
const isOpenAiKey = (value) => normalize(value).startsWith('sk-') && !normalize(value).startsWith('sk-or-v1');
const isProviderAuthError = (err) => {
  const message = typeof err?.message === 'string' ? err.message : '';
  return err?.status === 401 || err?.response?.status === 401 || message.includes('Incorrect API key provided');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const resolveReplicateModel = (value) => REPLICATE_MODEL_ALIASES[normalize(value)] || normalize(value) || REPLICATE_MODEL_ALIASES[DEFAULT_REPLICATE_STT_MODEL] || DEFAULT_REPLICATE_STT_MODEL;

const resolveOpenRouterKey = (primary) => {
  const primaryKey = normalize(primary);
  if (isOpenRouterKey(primaryKey)) return primaryKey;
  return '';
};

const resolveOpenAiKey = (primary) => {
  const primaryKey = normalize(primary);
  if (isOpenAiKey(primaryKey)) return primaryKey;
  return '';
};

const createOpenRouterClient = (apiKey) =>
  new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.FRONTEND_URL || 'https://studentsclients.mudrek.com',
      'X-Title': 'Mudrek AI CRM',
    },
  });

const createOpenAiClient = (apiKey) => new OpenAI({ apiKey });

const getOpenRouterClientOrThrow = async () => {
  const storedOpenRouterKey = await getSetting('OPENROUTER_API_KEY');
  const apiKey = resolveOpenRouterKey(storedOpenRouterKey);

  if (!apiKey) {
    const err = new Error('OpenRouter API key is not configured');
    err.statusCode = 503;
    throw err;
  }

  return { apiKey, client: createOpenRouterClient(apiKey) };
};

const getOpenAiClientOrThrow = async () => {
  const storedOpenAiKey = await getSetting('OPENAI_REALTIME_API_KEY');
  const apiKey = resolveOpenAiKey(storedOpenAiKey);

  if (!apiKey) {
    const err = new Error('OpenAI realtime API key is not configured');
    err.statusCode = 503;
    throw err;
  }

  return { apiKey, client: createOpenAiClient(apiKey) };
};

const extractJsonObject = (value) => {
  const raw = extractTextFromMessageContent(value);
  if (!raw) throw new Error('AI response was empty');

  const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);

  if (!candidate || !candidate.trim().startsWith('{')) {
    throw new Error('AI response did not contain a valid JSON object');
  }

  return JSON.parse(candidate);
};

const completeText = async (client, payload) => {
  const completion = await client.chat.completions.create(payload);
  return extractTextFromMessageContent(completion.choices?.[0]?.message?.content);
};

const buildPracticeSessionBlueprint = () => ({
  location: pickRandom(PRACTICE_LOCATIONS),
  industry: pickRandom(PRACTICE_INDUSTRIES),
  targetService: pickRandom(PRACTICE_SERVICES),
  personality: pickRandom(PRACTICE_PERSONALITIES),
  objectionAngle: pickRandom(PRACTICE_OBJECTION_ANGLES),
  difficulty: pickRandom(PRACTICE_DIFFICULTIES),
  budgetRange: pickRandom(PRACTICE_BUDGETS),
  digitalMaturity: pickRandom(PRACTICE_DIGITAL_MATURITY),
  companySize: pickRandom(PRACTICE_COMPANY_SIZES),
  scenarioType: pickRandom(PRACTICE_SCENARIO_TYPES),
  outreachChannel: pickRandom(PRACTICE_OUTREACH_CHANNELS),
  leadTemperature: pickRandom(PRACTICE_LEAD_TEMPERATURES),
});

const sanitizePracticeSession = (session, blueprint) => ({
  scenarioType:
    normalize(session?.scenarioType) === 'outbound'
      ? 'outbound'
      : blueprint.scenarioType === 'outbound'
        ? 'outbound'
        : 'inbound',
  clientName: normalize(session?.clientName) || 'عميل تجريبي',
  clientRole: normalize(session?.clientRole) || 'صاحب النشاط',
  businessName: normalize(session?.businessName) || 'نشاط تجاري محلي',
  industry: normalize(session?.industry) || blueprint.industry,
  location: normalize(session?.location) || blueprint.location,
  businessSummary: normalize(session?.businessSummary) || 'يحتاج إلى تحسين حضوره الرقمي وزيادة المبيعات.',
  companySize: normalize(session?.companySize) || blueprint.companySize,
  digitalMaturity: normalize(session?.digitalMaturity) || blueprint.digitalMaturity,
  targetService: normalize(session?.targetService) || blueprint.targetService,
  mainNeed: normalize(session?.mainNeed) || 'يريد خدمة رقمية تساعده على جلب عملاء بشكل أوضح.',
  budgetRange: normalize(session?.budgetRange) || blueprint.budgetRange,
  urgency: normalize(session?.urgency) || 'خلال الشهر الحالي',
  personality: normalize(session?.personality) || blueprint.personality,
  communicationStyle: normalize(session?.communicationStyle) || 'يفضل الكلام المباشر والواضح بدون مبالغة.',
  openingMood: normalize(session?.openingMood) || 'متحفظ لكنه مستعد يسمع لو العرض واضح.',
  outreachChannel: normalize(session?.outreachChannel) || blueprint.outreachChannel,
  leadTemperature: normalize(session?.leadTemperature) || blueprint.leadTemperature,
  firstContactHint: normalize(session?.firstContactHint) || 'ابدأ برسالة قصيرة تعرف فيها بنفسك وتربط خدمتك باحتياج النشاط.',
  difficulty: normalize(session?.difficulty) || blueprint.difficulty,
  discoveryTargets:
    Array.isArray(session?.discoveryTargets) && session.discoveryTargets.length
      ? session.discoveryTargets.map(normalize).filter(Boolean).slice(0, 5)
      : [
          'الاحتياج الحقيقي الآن',
          'الأولوية والوقت المناسب',
          'كيف يجلب العملاء حالياً',
          'الميزانية أو طريقة اتخاذ القرار',
        ],
  goals: Array.isArray(session?.goals) ? session.goals.map(normalize).filter(Boolean).slice(0, 4) : [],
  painPoints: Array.isArray(session?.painPoints) ? session.painPoints.map(normalize).filter(Boolean).slice(0, 4) : [],
  objections: Array.isArray(session?.objections) ? session.objections.map(normalize).filter(Boolean).slice(0, 4) : [],
  hiddenContext: Array.isArray(session?.hiddenContext) ? session.hiddenContext.map(normalize).filter(Boolean).slice(0, 4) : [],
  openingMessage:
    (normalize(session?.scenarioType) === 'outbound' ? '' : normalize(session?.openingMessage)) ||
    (blueprint.scenarioType === 'outbound' ? '' : 'أهلاً، أنا مهتم أعرف كيف ممكن تساعدني بخدمة رقمية تناسب شغلي.'),
});

const prunePracticeSessions = () => {
  const now = Date.now();
  for (const [sessionId, record] of practiceSessionStore.entries()) {
    if (!record || record.expiresAt <= now) {
      practiceSessionStore.delete(sessionId);
    }
  }
};

const createPracticeSessionRecord = (session) => {
  prunePracticeSessions();
  const sessionId = randomUUID();
  practiceSessionStore.set(sessionId, {
    session,
    expiresAt: Date.now() + PRACTICE_SESSION_TTL_MS,
  });
  return sessionId;
};

const getPracticeSessionRecord = (sessionId) => {
  prunePracticeSessions();
  const record = practiceSessionStore.get(sessionId);
  if (!record || record.expiresAt <= Date.now()) {
    practiceSessionStore.delete(sessionId);
    return null;
  }

  record.expiresAt = Date.now() + PRACTICE_SESSION_TTL_MS;
  return record;
};

const buildStudentPracticeSession = (session, sessionId) => {
  if (session.scenarioType !== 'outbound') {
    return { sessionId, ...session };
  }

  return {
    sessionId,
    scenarioType: session.scenarioType,
    outreachChannel: session.outreachChannel,
    leadTemperature: '',
    firstContactHint: session.firstContactHint,
    discoveryTargets: session.discoveryTargets,
    clientName: session.clientName,
    clientRole: session.clientRole,
    businessName: session.businessName,
    industry: session.industry,
    location: session.location,
    businessSummary: '',
    companySize: session.companySize,
    digitalMaturity: session.digitalMaturity,
    targetService: '',
    mainNeed: '',
    budgetRange: '',
    urgency: '',
    personality: '',
    communicationStyle: '',
    openingMood: '',
    difficulty: session.difficulty,
    goals: [],
    painPoints: [],
    objections: [],
    hiddenContext: [],
    openingMessage: '',
  };
};

const clampScore = (value, fallback = 60) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numeric)));
};

const safeArray = (value, maxItems = 5) =>
  Array.isArray(value) ? value.map(normalize).filter(Boolean).slice(0, maxItems) : [];

const safeTextBlock = (value) =>
  normalize(
    typeof value === 'string'
      ? value.replace(/\r/g, '').replace(/\u0000/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n')
      : ''
  );

const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const parseContextPayload = (body = {}) => {
  if (typeof body.context === 'string' && body.context.trim()) {
    try {
      return JSON.parse(body.context);
    } catch {
      return body;
    }
  }

  return body;
};

const normalizeProposalContext = (body = {}) => {
  const raw = parseContextPayload(body);
  return {
    clientName: normalize(raw?.clientName),
    businessName: normalize(raw?.businessName),
    industry: normalize(raw?.industry),
    contactRole: normalize(raw?.contactRole),
    offeredService: normalize(raw?.offeredService),
    proposalStage: normalize(raw?.proposalStage),
    budgetLevel: normalize(raw?.budgetLevel),
    urgencyLevel: normalize(raw?.urgencyLevel),
    mainGoal: normalize(raw?.mainGoal),
    knownObjections: normalize(raw?.knownObjections || raw?.objections),
    specialNotes: normalize(raw?.specialNotes || raw?.notes),
  };
};

const proposalContextToPrompt = (context) => {
  const entries = [
    ['اسم العميل', context.clientName],
    ['اسم النشاط', context.businessName],
    ['المجال', context.industry],
    ['صفة صاحب القرار أو جهة التواصل', context.contactRole],
    ['الخدمة المعروضة', context.offeredService],
    ['مرحلة المقترح', context.proposalStage],
    ['مستوى الميزانية', context.budgetLevel],
    ['درجة الاستعجال', context.urgencyLevel],
    ['الهدف الرئيسي للعميل', context.mainGoal],
    ['اعتراضات أو تحفظات معروفة', context.knownObjections],
    ['ملاحظات إضافية', context.specialNotes],
  ].filter(([, value]) => value);

  if (!entries.length) {
    return 'لا توجد معلومات إضافية عن العميل. راجع العرض كمقترح عام وحدد ما يجب تخصيصه للعميل.';
  }

  return entries.map(([label, value]) => `- ${label}: ${value}`).join('\n');
};

const extractProposalDocumentText = async (file) => {
  const extension = path.extname(file?.originalname || file?.path || '').toLowerCase();

  if (extension === '.pdf') {
    const parsed = await pdfParse(fs.readFileSync(file.path));
    return safeTextBlock(parsed?.text);
  }

  if (extension === '.docx') {
    const parsed = await mammoth.extractRawText({ path: file.path });
    return safeTextBlock(parsed?.value);
  }

  if (extension === '.doc') {
    const parsed = await wordExtractor.extract(file.path);
    return safeTextBlock(parsed?.getBody?.() || '');
  }

  if (extension === '.txt' || extension === '.md') {
    return safeTextBlock(fs.readFileSync(file.path, 'utf8'));
  }

  const unsupported = new Error('صيغة الملف غير مدعومة. استخدم PDF أو DOC أو DOCX أو TXT.');
  unsupported.statusCode = 400;
  throw unsupported;
};

const sanitizeProposalReview = (review) => ({
  overallScore: clampScore(review?.overallScore),
  executiveSummary:
    safeTextBlock(review?.executiveSummary) || 'المقترح يحتاج مراجعة أعمق قبل إرساله للعميل.',
  strengths: safeArray(review?.strengths, 5),
  weaknesses: safeArray(review?.weaknesses, 5),
  missingItems: safeArray(review?.missingItems, 5),
  riskFlags: safeArray(review?.riskFlags, 5),
  clientFitObservations: safeArray(review?.clientFitObservations, 5),
  rewriteSuggestions: safeArray(review?.rewriteSuggestions, 5),
  nextStepAdvice:
    safeTextBlock(review?.nextStepAdvice) || 'حدّث العرض ثم راجع الرسالة الافتتاحية والـ CTA قبل الإرسال.',
  improvedOpening: safeTextBlock(review?.improvedOpening),
});

const buildVoiceJourneyBlueprint = () => ({
  location: pickRandom(PRACTICE_LOCATIONS),
  industry: pickRandom(PRACTICE_INDUSTRIES),
  targetService: pickRandom(PRACTICE_SERVICES),
  personality: pickRandom(PRACTICE_PERSONALITIES),
  objectionAngle: pickRandom(PRACTICE_OBJECTION_ANGLES),
  budgetRange: pickRandom(PRACTICE_BUDGETS),
  digitalMaturity: pickRandom(PRACTICE_DIGITAL_MATURITY),
  companySize: pickRandom(PRACTICE_COMPANY_SIZES),
  dialect: pickRandom(PRACTICE_ARABIC_DIALECTS),
});

const sanitizeVoiceJourneyProfile = (profile, blueprint) => ({
  clientName: normalize(profile?.clientName) || 'عميل صوتي تدريبي',
  clientRole: normalize(profile?.clientRole) || 'صاحب النشاط',
  businessName: normalize(profile?.businessName) || 'نشاط محلي',
  industry: normalize(profile?.industry) || blueprint.industry,
  location: normalize(profile?.location) || blueprint.location,
  businessSummary:
    normalize(profile?.businessSummary) || 'نشاط يريد تحسين مخرجاته التسويقية وزيادة فرص البيع من القنوات الرقمية.',
  companySize: normalize(profile?.companySize) || blueprint.companySize,
  digitalMaturity: normalize(profile?.digitalMaturity) || blueprint.digitalMaturity,
  targetService: normalize(profile?.targetService) || blueprint.targetService,
  mainNeed: normalize(profile?.mainNeed) || 'يريد نتائج أوضح من التسويق أو المبيعات.',
  budgetRange: normalize(profile?.budgetRange) || blueprint.budgetRange,
  urgency: normalize(profile?.urgency) || 'خلال الأسابيع القادمة',
  personality: normalize(profile?.personality) || blueprint.personality,
  communicationStyle: normalize(profile?.communicationStyle) || 'يتحدث بشكل طبيعي على الهاتف ويكره الإطالة.',
  dialect: normalize(profile?.dialect) || blueprint.dialect,
  voiceStyle:
    normalize(profile?.voiceStyle) || `يتكلم بأسلوب ${normalize(profile?.dialect) || blueprint.dialect} مع نبرة طبيعية على الهاتف.`,
  publicBrief:
    normalize(profile?.publicBrief) || 'لديك معلومات أولية محدودة. استخدم المكالمة لاكتشاف الوضع الحقيقي ثم قدّم القيمة.',
  discoveryTargets:
    safeArray(profile?.discoveryTargets, 5).length
      ? safeArray(profile?.discoveryTargets, 5)
      : ['الاحتياج الحقيقي', 'الوضع الحالي', 'صاحب القرار', 'الميزانية أو الإطار المتوقع'],
  offerExpectations:
    safeArray(profile?.offerExpectations, 5).length
      ? safeArray(profile?.offerExpectations, 5)
      : ['عرض واضح', 'نتائج مفهومة', 'خطة تنفيذ مختصرة'],
  followUpConcerns:
    safeArray(profile?.followUpConcerns, 5).length
      ? safeArray(profile?.followUpConcerns, 5)
      : ['الالتزام', 'النتائج', 'وضوح التوقيت'],
  closingSignals:
    safeArray(profile?.closingSignals, 5).length
      ? safeArray(profile?.closingSignals, 5)
      : ['مستعد يبدأ لو اطمأن', 'يحتاج وضوحاً نهائياً', 'يهتم بالتنفيذ السلس'],
  objections:
    safeArray(profile?.objections, 5).length
      ? safeArray(profile?.objections, 5)
      : [blueprint.objectionAngle, 'يخاف من تكرار تجربة غير ناجحة'],
  hiddenContext:
    safeArray(profile?.hiddenContext, 5).length
      ? safeArray(profile?.hiddenContext, 5)
      : ['لديه ضغط على النتائج قريباً', 'يريد تقليل التجريب العشوائي'],
  decisionProcess:
    normalize(profile?.decisionProcess) || 'يراجع القرار بنفسه وقد يستشير شريكاً أو مديراً داخلياً قبل الحسم.',
});

const voiceStageLabel = (stage) => VOICE_JOURNEY_STAGE_META[stage]?.label || 'مرحلة غير معروفة';

const buildVoiceJourneyPublicView = (journey) => ({
  id: journey.id,
  clientName: journey.clientName,
  clientRole: journey.clientRole,
  businessName: journey.businessName,
  industry: journey.industry,
  location: journey.location,
  dialect: journey.dialect,
  stage: journey.stage,
  stageLabel: voiceStageLabel(journey.stage),
  status: journey.status,
  publicBrief: journey.publicBrief || '',
  historySummary: journey.historySummary || '',
  discoveredFacts: Array.isArray(journey.discoveredFacts) ? journey.discoveredFacts.filter(Boolean) : [],
  currentObjectives: VOICE_JOURNEY_STAGE_META[journey.stage]?.objectives || [],
  createdAt: journey.createdAt,
  updatedAt: journey.updatedAt,
  calls: Array.isArray(journey.calls)
    ? journey.calls.map((call) => ({
        id: call.id,
        stage: call.stage,
        stageLabel: voiceStageLabel(call.stage),
        status: call.status,
        score: call.score,
        summary: call.summary || '',
        durationSec: call.durationSec || 0,
        createdAt: call.createdAt,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
        review: call.review || null,
      }))
    : [],
});

const buildVoiceJourneySessionInstructions = (journey) => {
  const profile = journey.profile || {};
  const discoveredFacts = Array.isArray(journey.discoveredFacts) ? journey.discoveredFacts.filter(Boolean) : [];
  const stageObjectives = VOICE_JOURNEY_STAGE_META[journey.stage]?.objectives || [];
  const stageGuidance = {
    FIRST_OUTREACH:
      'هذه أول مكالمة فعلية من الطالب. جاوب كعميل يتلقى اتصال مبيعات لأول مرة: كن طبيعياً ومختصراً ولا تكشف كل شيء بسرعة. اسمح له أن يطلب الإذن ويثبت سبب المكالمة أولاً.',
    DISCOVERY_CALL:
      'هذه مكالمة اكتشاف بعد تواصل أولي سابق. كن أكثر استعداداً للكلام لكن اكشف المعلومات على قدر جودة الأسئلة فقط.',
    QUALIFICATION_CALL:
      'هذه مكالمة تأهيل قبل العرض النهائي. اختبر فهم الطالب، وكن حذراً في موضوع الميزانية والقرار ما لم يثبت أنه يفهم احتياجك جيداً.',
    OFFER_CALL:
      'هذه مكالمة عرض. الطالب سيعرض عليك الخدمة. ركّز على الملاءمة، النتائج، السعر، والخطوات العملية، ولا توافق بسهولة بدون وضوح.',
    FOLLOW_UP_CALL:
      'هذه مكالمة متابعة بعد العرض. لديك بعض التردد وتحتاج طمأنة أو توضيح نقاط معلقة قبل الحسم.',
    CLOSING_CALL:
      'هذه مكالمة حسم. اقترب من القرار النهائي، لكن اطلب وضوحاً عملياً إذا كان هناك شيء غير مقنع.',
  };

  return (
    'أنت الآن عميل محتمل في تدريب مبيعات صوتي مباشر. ابقَ داخل الشخصية تماماً ولا تتحول إلى مدرب أو مساعد. تحدث بالعربية فقط وباللهجة المطلوبة. هذه مكالمة هاتفية، لذلك اجعل ردودك قصيرة وطبيعية ومناسبة للمحادثة الصوتية، من جملة إلى ثلاث جمل غالباً. قاطع أحياناً بشكل طبيعي إذا لزم، وتصرّف مثل شخص حقيقي على الهاتف. لا تعطِ معلومات كثيرة دفعة واحدة. اكشف ما يناسب جودة السؤال فقط، وخاصة في المراحل المبكرة.\n\n' +
    `${stageGuidance[journey.stage] || ''}\n\n` +
    `اللهجة المطلوبة: ${journey.dialect}\n` +
    `أسلوب الصوت: ${profile.voiceStyle || journey.dialect}\n` +
    `اسم العميل: ${journey.clientName}\n` +
    `دور العميل: ${journey.clientRole}\n` +
    `اسم النشاط: ${journey.businessName}\n` +
    `المجال: ${journey.industry}\n` +
    `المدينة: ${journey.location}\n` +
    `ملخص النشاط: ${profile.businessSummary || ''}\n` +
    `حجم النشاط: ${profile.companySize || ''}\n` +
    `النضج الرقمي: ${profile.digitalMaturity || ''}\n` +
    `الخدمة الأقرب لاحتياجك: ${profile.targetService || ''}\n` +
    `الاحتياج الرئيسي: ${profile.mainNeed || ''}\n` +
    `الميزانية: ${profile.budgetRange || ''}\n` +
    `الاستعجال: ${profile.urgency || ''}\n` +
    `الشخصية: ${profile.personality || ''}\n` +
    `أسلوب التواصل: ${profile.communicationStyle || ''}\n` +
    `طريقة اتخاذ القرار: ${profile.decisionProcess || ''}\n` +
    `الاعتراضات الأساسية: ${(profile.objections || []).join(' | ') || 'غير مذكور'}\n` +
    `الخلفية الخفية: ${(profile.hiddenContext || []).join(' | ') || 'غير مذكور'}\n` +
    `المعلومات التي اكتشفها الطالب سابقاً: ${discoveredFacts.join(' | ') || 'لا شيء مؤكد بعد'}\n` +
    `ملخص العلاقة السابقة: ${journey.historySummary || 'لا يوجد تاريخ سابق'}\n` +
    `أهداف الطالب في هذه المرحلة: ${stageObjectives.join(' | ') || 'غير مذكور'}`
  );
};

const sanitizeVoiceCallReview = (review, currentStage) => {
  const nextStage = normalize(review?.nextStage).toUpperCase();
  const outcome = normalize(review?.outcome).toUpperCase();
  return {
    overallScore: clampScore(review?.overallScore),
    summary: safeTextBlock(review?.summary) || 'المكالمة تحتاج مراجعة قبل الانتقال للمرحلة التالية.',
    strengths: safeArray(review?.strengths, 5),
    misses: safeArray(review?.misses, 5),
    discoveredFacts: safeArray(review?.discoveredFacts, 6),
    nextAction: safeTextBlock(review?.nextAction) || 'نفّذ متابعة أوضح قبل المحاولة التالية.',
    nextStage: VOICE_JOURNEY_STAGES.includes(nextStage) ? nextStage : currentStage,
    outcome: ['ACTIVE', 'WON', 'LOST'].includes(outcome) ? outcome : 'ACTIVE',
    historySummary:
      safeTextBlock(review?.historySummary) || 'تمت مكالمة جديدة مع العميل ويحتاج الطالب لمتابعة أفضل في الخطوة القادمة.',
  };
};

const buildVoiceJourneyFallbackProfile = (blueprint) => ({
  clientName: 'أحمد الخطيب',
  clientRole: 'صاحب النشاط',
  businessName: 'ستوديو نمو',
  industry: blueprint.industry,
  location: blueprint.location,
  businessSummary: `نشاط في مجال ${blueprint.industry} يبحث عن طريقة أكثر انتظاماً لزيادة الطلبات أو العملاء.`,
  companySize: blueprint.companySize,
  digitalMaturity: blueprint.digitalMaturity,
  targetService: blueprint.targetService,
  mainNeed: 'يريد زيادة العملاء مع وضوح أكبر في النتائج.',
  budgetRange: blueprint.budgetRange,
  urgency: 'خلال هذا الشهر',
  personality: blueprint.personality,
  communicationStyle: 'يتكلم باختصار على الهاتف ويحب الوضوح.',
  dialect: blueprint.dialect,
  voiceStyle: `يتكلم بلهجة ${blueprint.dialect} بشكل طبيعي ومهذب.`,
  publicBrief: 'عميل محتمل يحتاج إلى فهم سريع وواضح قبل أن يعطي وقتاً أو اهتماماً أكبر.',
  discoveryTargets: ['الوضع الحالي', 'الاحتياج الحقيقي', 'صاحب القرار', 'إمكانية الانتقال لاكتشاف أعمق'],
  offerExpectations: ['عرض واضح', 'نتائج مفهومة', 'خطة مختصرة'],
  followUpConcerns: ['السعر', 'وضوح التنفيذ', 'إثبات الجدية'],
  closingSignals: ['مستعد إذا اقتنع', 'يهتم بالتنفيذ السريع'],
  objections: [blueprint.objectionAngle],
  hiddenContext: ['تجربته السابقة لم تكن مستقرة', 'لا يريد إضاعة وقت إضافي'],
  decisionProcess: 'يميل لاتخاذ القرار بنفسه بعد أن يقتنع منطقياً.',
});

const generateVoiceJourneyProfile = async (client) => {
  const blueprint = buildVoiceJourneyBlueprint();

  try {
    const responseText = await completeText(client, {
      model: DEFAULT_OPENAI_TEXT_MODEL,
      temperature: 0.95,
      messages: [
        {
          role: 'system',
          content:
            'You generate Arabic voice-sales roleplay client profiles for training. Return one JSON object only with no markdown or extra text. The JSON keys must be exactly: clientName, clientRole, businessName, industry, location, businessSummary, companySize, digitalMaturity, targetService, mainNeed, budgetRange, urgency, personality, communicationStyle, dialect, voiceStyle, publicBrief, discoveryTargets, offerExpectations, followUpConcerns, closingSignals, objections, hiddenContext, decisionProcess. All values must be Arabic. Arrays must contain 2 to 5 short Arabic strings. publicBrief must be safe to show the student before the first call and should not reveal all hidden details. Make the persona realistic for a professional Arabic sales call.',
        },
        {
          role: 'user',
          content:
            `أنشئ عميلاً صوتياً تدريبياً بهذه الملامح العامة:\n` +
            `- المدينة: ${blueprint.location}\n` +
            `- المجال: ${blueprint.industry}\n` +
            `- الخدمة المرجحة: ${blueprint.targetService}\n` +
            `- الشخصية: ${blueprint.personality}\n` +
            `- الاعتراض الأساسي: ${blueprint.objectionAngle}\n` +
            `- الميزانية: ${blueprint.budgetRange}\n` +
            `- النضج الرقمي: ${blueprint.digitalMaturity}\n` +
            `- حجم النشاط: ${blueprint.companySize}\n` +
            `- اللهجة: ${blueprint.dialect}\n\n` +
            'هذا العميل سيخوض رحلة مبيعات عبر عدة مكالمات: أول اتصال ثم اكتشاف ثم تأهيل ثم عرض ثم متابعة ثم حسم. اجعل الملف مناسباً لهذه الرحلة.',
        },
      ],
    });

    return sanitizeVoiceJourneyProfile(extractJsonObject(responseText), blueprint);
  } catch {
    return sanitizeVoiceJourneyProfile(buildVoiceJourneyFallbackProfile(blueprint), blueprint);
  }
};

const mergeDiscoveredFacts = (existingFacts, newFacts) => {
  const merged = new Set([
    ...(Array.isArray(existingFacts) ? existingFacts.map(normalize).filter(Boolean) : []),
    ...safeArray(newFacts, 8),
  ]);
  return Array.from(merged).slice(0, 10);
};

const detectAudioFormat = (file) => {
  const extension = path.extname(file?.originalname || file?.path || '')
    .toLowerCase()
    .replace('.', '');

  const knownExtensions = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aiff']);
  if (knownExtensions.has(extension)) return extension;

  const mimeType = (file?.mimetype || '').toLowerCase();
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('x-m4a') || mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('aac')) return 'aac';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('flac')) return 'flac';
  if (mimeType.includes('aiff')) return 'aiff';

  return 'wav';
};

const extractTextFromMessageContent = (content) => {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.transcript === 'string') return part.transcript;
      return '';
    })
    .join('\n')
    .trim();
};

const uploadFileToReplicate = async (filePath, originalName, mimeType, apiToken) => {
  const form = new FormData();
  form.append('content', fs.createReadStream(filePath), {
    filename: originalName || path.basename(filePath),
    contentType: mimeType || 'application/octet-stream',
  });
  form.append('filename', originalName || path.basename(filePath));
  form.append('type', mimeType || 'application/octet-stream');

  const response = await axios.post('https://api.replicate.com/v1/files', form, {
    headers: {
      Authorization: `Token ${apiToken}`,
      ...form.getHeaders(),
    },
    maxBodyLength: Infinity,
    timeout: 300000,
  });

  return response.data;
};

const waitForReplicatePrediction = async (predictionUrl, apiToken) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await axios.get(predictionUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      timeout: 300000,
    });

    const prediction = response.data;
    if (REPLICATE_TERMINAL_STATUSES.has(prediction?.status)) {
      return prediction;
    }

    await sleep(1500);
  }

  throw new Error('Replicate transcription timed out');
};

const extractReplicateTranscript = (prediction) => {
  const output = prediction?.output;

  if (typeof output === 'string') return output.trim();
  if (typeof output?.transcription === 'string') return output.transcription.trim();
  if (typeof output?.text === 'string') return output.text.trim();

  return '';
};

const transcribeWithReplicate = async (file, apiToken, modelIdentifier) => {
  const uploadedFile = await uploadFileToReplicate(
    file.path,
    file.originalname,
    file.mimetype,
    apiToken
  );

  try {
    const predictionResponse = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: modelIdentifier,
        input: {
          audio: uploadedFile?.urls?.get,
          language: 'ar',
          transcription: 'plain text',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=60',
        },
        timeout: 300000,
      }
    );

    const initialPrediction = predictionResponse.data;
    const finalPrediction = REPLICATE_TERMINAL_STATUSES.has(initialPrediction?.status)
      ? initialPrediction
      : await waitForReplicatePrediction(initialPrediction?.urls?.get, apiToken);

    if (finalPrediction?.status !== 'succeeded') {
      throw new Error(finalPrediction?.error || 'Replicate transcription failed');
    }

    const transcript = extractReplicateTranscript(finalPrediction);
    if (!transcript) {
      throw new Error('Replicate transcription returned an empty transcript');
    }

    return transcript;
  } finally {
    if (uploadedFile?.urls?.get) {
      try {
        await axios.delete(uploadedFile.urls.get, {
          headers: {
            Authorization: `Token ${apiToken}`,
          },
          timeout: 30000,
        });
      } catch {
      }
    }
  }
};

const transcribeWithOpenRouter = async (file, apiKey) => {
  const base64Audio = fs.readFileSync(file.path, { encoding: 'base64' });
  const audioFormat = detectAudioFormat(file);

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: DEFAULT_OPENROUTER_AUDIO_MODEL,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe this sales call in Arabic. Return only the transcript text. Do not summarize. Do not add markdown.',
            },
            {
              type: 'input_audio',
              input_audio: {
                data: base64Audio,
                format: audioFormat,
              },
            },
          ],
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://studentsclients.mudrek.com',
        'X-Title': 'Mudrek AI CRM',
      },
      maxBodyLength: Infinity,
      timeout: 300000,
    }
  );

  const message = response.data?.choices?.[0]?.message;
  const transcript =
    extractTextFromMessageContent(message?.content) ||
    message?.audio?.transcript ||
    '';

  if (!transcript.trim()) {
    throw new Error('OpenRouter transcription returned an empty transcript');
  }

  return transcript.trim();
};

const transcribeCall = async (file, replicateToken, replicateModel, openRouterKey) => {
  if (replicateToken) {
    try {
      return await transcribeWithReplicate(file, replicateToken, replicateModel);
    } catch (err) {
      if (!openRouterKey) throw err;
    }
  }

  if (!openRouterKey) {
    throw new Error('No speech-to-text provider is configured');
  }

  return transcribeWithOpenRouter(file, openRouterKey);
};

const createPracticeSession = async (req, res) => {
  try {
    const { client } = await getOpenRouterClientOrThrow();
    const blueprint = buildPracticeSessionBlueprint();

    const responseText = await completeText(client, {
      model: DEFAULT_OPENROUTER_TEXT_MODEL,
      temperature: 1.15,
      messages: [
        {
          role: 'system',
          content:
            'You generate Arabic roleplay scenarios for sales students. Return one JSON object only with no markdown, no explanation, and no extra text. The JSON keys must be exactly: scenarioType, outreachChannel, leadTemperature, firstContactHint, discoveryTargets, clientName, clientRole, businessName, industry, location, businessSummary, companySize, digitalMaturity, targetService, mainNeed, budgetRange, urgency, personality, communicationStyle, openingMood, difficulty, goals, painPoints, objections, hiddenContext, openingMessage. scenarioType must be either "inbound" or "outbound". discoveryTargets must be an array of 3 to 5 short Arabic items describing what the student should discover, not the answers themselves. For inbound scenarios, openingMessage must contain the client first message and firstContactHint can be brief. For outbound scenarios, openingMessage must be an empty string, firstContactHint must clearly tell the student how to start the first outreach, and discoveryTargets should focus on things the student still needs to uncover such as budget, urgency, decision process, current pain, and service fit. All narrative values must be Arabic except proper business names if needed. Arrays must contain 2 to 4 short Arabic strings unless discoveryTargets is provided with 3 to 5 items. Make the scenario realistic, specific, and naturally varied.',
        },
        {
          role: 'user',
          content:
            `ابنِ عميلاً جديداً مختلفاً تماماً للتدريب على بيع الخدمات الرقمية. استخدم هذه القيود كإلهام أساسي ووسّعها بشكل منطقي:\n` +
            `- المدينة: ${blueprint.location}\n` +
            `- المجال: ${blueprint.industry}\n` +
            `- الخدمة الرقمية المرجحة: ${blueprint.targetService}\n` +
            `- نوع الشخصية: ${blueprint.personality}\n` +
            `- زاوية الاعتراض الأساسية: ${blueprint.objectionAngle}\n` +
            `- مستوى الصعوبة: ${blueprint.difficulty}\n` +
            `- الميزانية: ${blueprint.budgetRange}\n` +
            `- مستوى النضج الرقمي: ${blueprint.digitalMaturity}\n` +
            `- حجم النشاط: ${blueprint.companySize}\n` +
            `- نوع السيناريو: ${blueprint.scenarioType === 'outbound' ? 'الطالب هو من يبدأ الرسالة الأولى' : 'العميل هو من يبدأ المحادثة'}\n` +
            `- قناة التواصل: ${blueprint.outreachChannel}\n` +
            `- حرارة العميل: ${blueprint.leadTemperature}\n\n` +
            'إذا كان السيناريو outbound فالمطلوب أن تكون معلومات العميل جاهزة لكن يبدأ الطالب أول رسالة outreach. وإذا كان inbound فابدأ برسالة افتتاحية من العميل نفسه. أريد سيناريو يقيّم الطالب كمزوّد خدمة ومندوب مبيعات في نفس الوقت.',
        },
      ],
    });

    const parsed = extractJsonObject(responseText);
    const session = sanitizePracticeSession(parsed, blueprint);
    const sessionId = createPracticeSessionRecord(session);

    return res.json({ success: true, data: buildStudentPracticeSession(session, sessionId) });
  } catch (err) {
    console.error('AI Practice Session Error:', err);
    if (isProviderAuthError(err)) {
      return error(res, 'مفتاح OpenRouter غير صحيح. راجع إعدادات الذكاء الاصطناعي.', 401);
    }

    const statusCode = err.statusCode || 502;
    return error(res, statusCode === 503 ? 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.' : 'فشل إنشاء جلسة العميل التجريبية', statusCode);
  }
};

const practiceChat = async (req, res) => {
  const { messages, sessionId } = req.body || {};

  if (!normalize(sessionId)) {
    return error(res, 'معرّف جلسة العميل مطلوب', 400);
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return error(res, 'يجب إرسال سجل المحادثة', 400);
  }

  const safeMessages = messages
    .filter((message) => ['user', 'assistant'].includes(message?.role) && normalize(message?.content))
    .map((message) => ({ role: message.role, content: normalize(message.content) }));

  if (!safeMessages.length) {
    return error(res, 'سجل المحادثة غير صالح', 400);
  }

  try {
    const { client } = await getOpenRouterClientOrThrow();
    const sessionRecord = getPracticeSessionRecord(normalize(sessionId));
    if (!sessionRecord) {
      return error(res, 'انتهت جلسة التدريب أو لم تعد متاحة. أنشئ جلسة جديدة وحاول مرة أخرى.', 410);
    }

    const safeSession = sessionRecord.session;
    const reply = await completeText(client, {
      model: DEFAULT_OPENROUTER_TEXT_MODEL,
      temperature: 0.95,
      messages: [
        {
          role: 'system',
          content:
            'أنت الآن تمثل عميلاً محتملاً حقيقياً داخل تدريب مبيعات. ابقَ داخل الشخصية دائماً ولا تتحول إلى مدرب أو مساعد أو شارح. تحدث بالعربية الطبيعية فقط. يجب أن تتصرف حسب الملف التالي بدقة، مع كشف المعلومات تدريجياً مثل عميل حقيقي، ومع الحفاظ على الاعتراضات والشخصية ونبرة الحديث. لا تكتب أي تنسيق خاص أو قوائم إلا إذا طلب منك الطالب ذلك بشكل مباشر. اجعل ردك من جملتين إلى خمس جمل كحد أقصى، وكن واقعياً: قد تتحمس، قد تعترض، قد تسأل، وقد تطلب إثباتاً أو أمثلة، لكن لا توافق بسهولة غير منطقية. إذا كان السيناريو outbound فهذا يعني أن الطالب بدأ أول outreach وأنت ترد عليه كعميل تلقى الرسالة لأول مرة. إذا كان السيناريو inbound فهذا يعني أنك أنت من بدأت الحديث من الأصل. في جلسات outbound لا تكشف الملف كاملاً دفعة واحدة: اكشف فقط ما يناسب سؤال الطالب الحالي، ولا تعطِ الميزانية أو الاستعجال أو آلية اتخاذ القرار أو الألم الحقيقي إلا عندما يطرح الطالب أسئلة اكتشاف مناسبة أو يربط عرضه بشكل منطقي. إذا كانت رسالة الطالب عامة أو اندفاعية فكن عاماً أو متحفظاً، واسمح له أن يجمع التفاصيل خطوة خطوة. لا تكشف أكثر من معلومة أو معلومتين جديدتين في الرد الواحد إلا إذا كان الحوار يبرر ذلك بوضوح.\n\n' +
            `نوع السيناريو: ${safeSession.scenarioType}\n` +
            `قناة التواصل: ${safeSession.outreachChannel}\n` +
            `حرارة العميل: ${safeSession.leadTemperature}\n` +
            `توجيه أول تواصل: ${safeSession.firstContactHint}\n` +
            `أشياء يجب أن يكتشفها الطالب: ${safeSession.discoveryTargets.join(' | ') || 'غير مذكور'}\n` +
            `الاسم: ${safeSession.clientName}\n` +
            `الدور: ${safeSession.clientRole}\n` +
            `اسم النشاط: ${safeSession.businessName}\n` +
            `المجال: ${safeSession.industry}\n` +
            `المدينة: ${safeSession.location}\n` +
            `ملخص النشاط: ${safeSession.businessSummary}\n` +
            `الحجم: ${safeSession.companySize}\n` +
            `النضج الرقمي: ${safeSession.digitalMaturity}\n` +
            `الخدمة الأقرب لاحتياجه: ${safeSession.targetService}\n` +
            `الاحتياج الرئيسي: ${safeSession.mainNeed}\n` +
            `الميزانية: ${safeSession.budgetRange}\n` +
            `الاستعجال: ${safeSession.urgency}\n` +
            `الشخصية: ${safeSession.personality}\n` +
            `أسلوب التواصل: ${safeSession.communicationStyle}\n` +
            `المزاج الافتتاحي: ${safeSession.openingMood}\n` +
            `درجة الصعوبة: ${safeSession.difficulty}\n` +
            `الأهداف: ${safeSession.goals.join(' | ') || 'غير مذكورة'}\n` +
            `نقاط الألم: ${safeSession.painPoints.join(' | ') || 'غير مذكورة'}\n` +
            `الاعتراضات: ${safeSession.objections.join(' | ') || 'غير مذكورة'}\n` +
            `سياق خفي: ${safeSession.hiddenContext.join(' | ') || 'غير مذكور'}`,
        },
        ...safeMessages,
      ],
    });

    return res.json({
      success: true,
      data: {
        reply: normalize(reply) || 'ممكن توضح لي أكثر كيف ستفيدني الخدمة فعلياً؟',
      },
    });
  } catch (err) {
    console.error('AI Practice Chat Error:', err);
    if (isProviderAuthError(err)) {
      return error(res, 'مفتاح OpenRouter غير صحيح. راجع إعدادات الذكاء الاصطناعي.', 401);
    }

    const statusCode = err.statusCode || 502;
    return error(res, statusCode === 503 ? 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.' : 'فشل الرد من العميل التجريبي', statusCode);
  }
};

const chatStream = async (req, res) => {
  const { messages, leadContext, model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return error(res, 'يجب إرسال مصفوفة الرسائل (messages)', 400);
  }

  try {
    const { client } = await getOpenRouterClientOrThrow();
    let systemPrompt = 'أنت مساعد مبيعات ذكي محترف لمساعدة الطلاب على إغلاق الصفقات وإقناع العملاء في نظام مدرك CRM. أجب باحترافية، وقدم نصائح عملية واقتراحات لرسائل أو عروض جاهزة.';

    if (leadContext) {
      systemPrompt += `\n\nأنت الآن تساعد في الرد على عميل محدد. بيانات العميل الحالي:\n` +
        `- الاسم: ${leadContext.name || 'غير محدد'}\n` +
        `- الخدمة المطلوبة: ${leadContext.service || 'غير محدد'}\n` +
        `- الميزانية: ${leadContext.budget || 'غير محدد'}\n` +
        `- ملاحظات هامة: ${leadContext.notes || 'لا يوجد'}`;
    }

    const stream = await client.chat.completions.create({
      model: model || DEFAULT_OPENROUTER_TEXT_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('OpenRouter Chat Error:', err);
    if (!res.headersSent) {
      if (isProviderAuthError(err)) {
        return error(res, 'مفتاح OpenRouter غير صحيح. راجع إعدادات الذكاء الاصطناعي.', 401);
      }
      return error(res, err.statusCode === 503 ? 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.' : 'فشل الاتصال بخادم الذكاء الاصطناعي', err.statusCode || 502);
    }
    res.end();
  }
};

const analyzeCall = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'لم يتم إرفاق ملف صوتي' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, transform=unsafe-inline');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(':' + Array(2048).fill(' ').join('') + '\n\n');

  const emit = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    if (res.flush) res.flush();
  };

  try {
    const rawOpenRouterKey = await getSetting('OPENROUTER_API_KEY');
    const rawReplicateToken = await getSetting('REPLICATE_API_TOKEN');
    const rawReplicateModel = await getSetting('REPLICATE_STT_MODEL');

    const openRouterKey = resolveOpenRouterKey(rawOpenRouterKey);
    const replicateToken = normalize(rawReplicateToken);
    const replicateModel = resolveReplicateModel(rawReplicateModel);

    if (!replicateToken && !openRouterKey) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      emit({ error: 'تفريغ الصوت يحتاج مفتاح Replicate أو OpenRouter صالحاً في صفحة الإعدادات.' });
      return res.end();
    }

    if (!openRouterKey) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      emit({ error: 'تحليل المكالمة يحتاج مفتاح OpenRouter صالحاً لأن التقييم النصي يتم عبر OpenRouter.' });
      return res.end();
    }

    emit({ status: 'transcribing' });

    const transcriptText = await transcribeCall(
      req.file,
      replicateToken,
      replicateModel,
      openRouterKey
    );

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    if (!transcriptText || transcriptText.trim().length < 10) {
      emit({ error: 'لا يوجد كلام واضح في المقطع أو المقطع قصير جداً' });
      return res.end();
    }

    emit({ status: 'analyzing', transcript: transcriptText });

    const openRouterClient = createOpenRouterClient(openRouterKey);
    const stream = await openRouterClient.chat.completions.create({
      model: DEFAULT_OPENROUTER_TEXT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'أنت مدير مبيعات محترف صارم وعادل. قم بتقييم مكالمة المبيعات الآتية وقدم نصائحك للموظف واذكر الاعتراضات التي لم يتعامل معها بشكل جيد. اجعل إجابتك بصيغة ماركداون منسقة. في نهاية إجابتك تماماً، وفي سطر منفصل، يجب أن تكتب التقييم النهائي من 100 بالصيغة الآتية حرفياً: [التقييم: 85]',
        },
        {
          role: 'user',
          content: `تفريغ المكالمة الصوتية:\n\n${transcriptText}`,
        },
      ],
      stream: true,
    });

    let fullFeedback = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullFeedback += delta;
        emit({ status: 'typing', text: delta });
      }
    }

    const scoreMatch = fullFeedback.match(/\[التقييم:\s*(\d+)\]/);
    const numericScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;
    const cleanFeedback = fullFeedback.replace(/\[التقييم:\s*\d+\]/g, '').trim();

    const analysis = await prisma.callAnalysis.create({
      data: {
        studentId: req.user.id,
        score: numericScore,
        transcript: transcriptText,
        feedback: cleanFeedback,
        durationSec: 0,
      },
    });

    emit({ status: 'done', data: analysis });
    res.end();
  } catch (err) {
    console.error('AI Call Analysis Error:', err);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    if (isProviderAuthError(err)) {
      emit({ error: 'فشل التحقق من مفاتيح مزود الذكاء الاصطناعي. راجع إعدادات OpenRouter و Replicate ثم جرّب مرة أخرى.' });
      return res.end();
    }

    emit({ error: 'حدث خطأ داخلي أثناء تحليل المكالمة: ' + (err.message || 'Unknown error') });
    res.end();
  }
};

const reviewProposal = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'لم يتم إرفاق ملف العرض أو المقترح' });
  }

  try {
    const { client } = await getOpenRouterClientOrThrow();
    const clientContext = normalizeProposalContext(req.body || {});
    const extractedText = await extractProposalDocumentText(req.file);

    if (!extractedText || extractedText.length < 80) {
      return error(res, 'تعذر استخراج نص كافٍ من الملف. جرّب نسخة أوضح أو ملف PDF/DOCX نصي.', 400);
    }

    const truncated = extractedText.length > PROPOSAL_REVIEW_TEXT_LIMIT;
    const proposalText = truncated ? extractedText.slice(0, PROPOSAL_REVIEW_TEXT_LIMIT) : extractedText;
    const reviewText = await completeText(client, {
      model: DEFAULT_OPENROUTER_TEXT_MODEL,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content:
            'أنت مراجع عروض ومقترحات مبيعات احترافي وصارم. قيّم جودة العرض التجاري من حيث الوضوح، الإقناع، بناء الثقة، تخصيصه للعميل، منطق الخدمة، هيكل العرض، إبراز النتائج، معالجة المخاطر، وقوة الخطوة التالية. أعد JSON فقط بلا شرح إضافي وبالمفاتيح التالية فقط: overallScore, executiveSummary, strengths, weaknesses, missingItems, riskFlags, clientFitObservations, rewriteSuggestions, nextStepAdvice, improvedOpening. overallScore رقم صحيح من 0 إلى 100. executiveSummary فقرة عربية قصيرة من 2 إلى 4 جمل. strengths و weaknesses و missingItems و riskFlags و clientFitObservations و rewriteSuggestions مصفوفات من 2 إلى 5 عناصر عربية قصيرة وواضحة. nextStepAdvice من جملة إلى 3 جمل. improvedOpening إعادة كتابة عربية مقترحة لبداية العرض من 2 إلى 5 جمل تكون أكثر إقناعاً وتخصيصاً. إذا كانت معلومات العميل ناقصة فاذكر أين يحتاج العرض لتخصيص إضافي بدلاً من التخمين.',
        },
        {
          role: 'user',
          content:
            `معلومات العميل المتاحة:\n${proposalContextToPrompt(clientContext)}\n\n` +
            `نص العرض أو المقترح المستخرج من الملف:\n"""\n${proposalText}\n"""`,
        },
      ],
    });

    const parsedReview = extractJsonObject(reviewText);
    return res.json({
      success: true,
      data: {
        review: sanitizeProposalReview(parsedReview),
        fileName: req.file.originalname,
        extractedChars: extractedText.length,
        truncated,
        contextUsed: Object.values(clientContext).some(Boolean),
      },
    });
  } catch (err) {
    console.error('AI Proposal Review Error:', err);
    if (isProviderAuthError(err)) {
      return error(res, 'مفتاح OpenRouter غير صحيح. راجع إعدادات الذكاء الاصطناعي.', 401);
    }

    return error(
      res,
      err.statusCode === 503
        ? 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.'
        : err.message || 'فشل مراجعة العرض أو المقترح',
      err.statusCode || 502
    );
  } finally {
    cleanupTempFile(req.file?.path);
  }
};

const getVoiceAvailability = async (_req, res) => {
  try {
    const apiKey = resolveOpenAiKey(await getSetting('OPENAI_REALTIME_API_KEY'));
    return res.json({
      success: true,
      data: {
        enabled: Boolean(apiKey),
      },
    });
  } catch (err) {
    console.error('Voice Availability Error:', err);
    return error(res, 'فشل التحقق من توفر المكالمات الصوتية', 500);
  }
};

const getVoiceJourneyWhere = (req, id) =>
  req.user.role === 'ADMIN'
    ? { id }
    : { id, studentId: req.user.id };

const listVoiceJourneys = async (req, res) => {
  try {
    const journeys = await prisma.voicePracticeJourney.findMany({
      where: req.user.role === 'ADMIN' ? {} : { studentId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        calls: {
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      },
    });

    return res.json({ success: true, data: journeys.map(buildVoiceJourneyPublicView) });
  } catch (err) {
    console.error('Voice Journey List Error:', err);
    return error(res, 'فشل جلب رحلات التدريب الصوتي', 500);
  }
};

const createVoiceJourney = async (req, res) => {
  try {
    const { client } = await getOpenAiClientOrThrow();
    const profile = await generateVoiceJourneyProfile(client);
    const journey = await prisma.voicePracticeJourney.create({
      data: {
        studentId: req.user.id,
        clientName: profile.clientName,
        clientRole: profile.clientRole,
        businessName: profile.businessName,
        industry: profile.industry,
        location: profile.location,
        dialect: profile.dialect,
        publicBrief: profile.publicBrief,
        historySummary: 'هذه أول مرة تتواصل فيها مع هذا العميل.',
        profile,
        discoveredFacts: [],
      },
      include: {
        calls: {
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      },
    });

    return res.json({ success: true, data: buildVoiceJourneyPublicView(journey) });
  } catch (err) {
    console.error('Voice Journey Create Error:', err);
    if (isProviderAuthError(err)) {
      return error(res, 'مفتاح OpenAI غير صحيح. راجع إعدادات Realtime.', 401);
    }

    return error(
      res,
      err.statusCode === 503
        ? 'مفتاح OpenAI Realtime غير متوفر. أضفه من الإعدادات أولاً.'
        : 'فشل إنشاء عميل صوتي جديد',
      err.statusCode || 502
    );
  }
};

const startVoiceJourneyCall = async (req, res) => {
  const { journeyId } = req.params;

  try {
    const journey = await prisma.voicePracticeJourney.findFirst({
      where: getVoiceJourneyWhere(req, journeyId),
      include: {
        calls: {
          where: { status: 'IN_PROGRESS' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!journey) {
      return error(res, 'رحلة العميل الصوتي غير موجودة', 404);
    }

    if (journey.status !== 'ACTIVE') {
      return error(res, 'هذه الرحلة ليست نشطة حالياً', 400);
    }

    const call = journey.calls[0]
      || await prisma.voicePracticeCall.create({
        data: {
          journeyId: journey.id,
          stage: journey.stage,
        },
      });

    return res.json({
      success: true,
      data: {
        callId: call.id,
        stage: journey.stage,
        stageLabel: voiceStageLabel(journey.stage),
        journey: buildVoiceJourneyPublicView({ ...journey, calls: [] }),
      },
    });
  } catch (err) {
    console.error('Voice Call Start Error:', err);
    return error(res, 'فشل بدء المكالمة التدريبية', 500);
  }
};

const createVoiceJourneySession = async (req, res) => {
  const { journeyId, callId } = req.params;
  const sdp = typeof req.body === 'string' ? req.body.trim() : '';

  if (!sdp) {
    return error(res, 'بيانات SDP مطلوبة لبدء جلسة الصوت', 400);
  }

  try {
    const journey = await prisma.voicePracticeJourney.findFirst({
      where: getVoiceJourneyWhere(req, journeyId),
    });

    if (!journey) {
      return error(res, 'رحلة العميل الصوتي غير موجودة', 404);
    }

    const call = await prisma.voicePracticeCall.findFirst({
      where: {
        id: callId,
        journeyId: journey.id,
        status: 'IN_PROGRESS',
      },
    });

    if (!call) {
      return error(res, 'لا توجد مكالمة نشطة لهذه الرحلة', 404);
    }

    const { apiKey } = await getOpenAiClientOrThrow();
    const sessionConfig = {
      type: 'realtime',
      model: DEFAULT_OPENAI_REALTIME_MODEL,
      instructions: buildVoiceJourneySessionInstructions(journey),
      audio: {
        input: {
          turn_detection: {
            type: 'server_vad',
          },
        },
        output: {
          voice: DEFAULT_OPENAI_REALTIME_VOICE,
        },
      },
      input_audio_transcription: {
        model: DEFAULT_OPENAI_TRANSCRIPTION_MODEL,
      },
    };

    const form = new FormData();
    form.append('sdp', sdp);
    form.append('session', JSON.stringify(sessionConfig));

    const response = await axios.post('https://api.openai.com/v1/realtime/calls', form, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      responseType: 'text',
      transformResponse: [(data) => data],
      maxBodyLength: Infinity,
    });

    res.setHeader('Content-Type', 'application/sdp');
    return res.send(response.data);
  } catch (err) {
    console.error('Voice Session Create Error:', err?.response?.data || err);
    if (isProviderAuthError(err)) {
      return error(res, 'مفتاح OpenAI Realtime غير صحيح.', 401);
    }

    return error(
      res,
      err.statusCode === 503
        ? 'مفتاح OpenAI Realtime غير متوفر. أضفه من الإعدادات أولاً.'
        : 'فشل إنشاء جلسة المكالمة الصوتية',
      err?.response?.status || err.statusCode || 502
    );
  }
};

const completeVoiceJourneyCall = async (req, res) => {
  const { journeyId, callId } = req.params;
  const transcriptSegments = Array.isArray(req.body?.transcriptSegments) ? req.body.transcriptSegments : [];
  const durationSec = Math.max(0, Math.round(Number(req.body?.durationSec) || 0));

  try {
    const journey = await prisma.voicePracticeJourney.findFirst({
      where: getVoiceJourneyWhere(req, journeyId),
    });

    if (!journey) {
      return error(res, 'رحلة العميل الصوتي غير موجودة', 404);
    }

    const call = await prisma.voicePracticeCall.findFirst({
      where: {
        id: callId,
        journeyId: journey.id,
        status: 'IN_PROGRESS',
      },
    });

    if (!call) {
      return error(res, 'المكالمة غير موجودة أو تم إنهاؤها بالفعل', 404);
    }

    const transcriptText = transcriptSegments
      .map((segment) => {
        const speaker = normalize(segment?.speaker) === 'client' ? 'العميل' : 'المتدرب';
        const text = safeTextBlock(segment?.text);
        return text ? `${speaker}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');

    let review = {
      overallScore: 45,
      summary: 'المكالمة انتهت بمعلومات محدودة وتحتاج إلى مراجعة أفضل في المحاولة القادمة.',
      strengths: [],
      misses: ['لم يتم جمع تفاصيل كافية من الحوار الحالي'],
      discoveredFacts: [],
      nextAction: 'أعد المحاولة مع افتتاحية أوضح وأسئلة اكتشاف أقوى.',
      nextStage: journey.stage,
      outcome: 'ACTIVE',
      historySummary: 'تمت محاولة اتصال صوتي لكن لم تُجمع معلومات كافية للتقدم.',
    };

    if (transcriptText.length >= 40) {
      try {
        const { client } = await getOpenAiClientOrThrow();
        const reviewText = await completeText(client, {
          model: DEFAULT_OPENAI_TEXT_MODEL,
          temperature: 0.35,
          messages: [
            {
              role: 'system',
              content:
                'أنت مدير مبيعات يراجع مكالمة تدريبية ضمن رحلة بيع احترافية. أعد JSON فقط بلا أي نص إضافي، وبالمفاتيح التالية فقط: overallScore, summary, strengths, misses, discoveredFacts, nextAction, nextStage, outcome, historySummary. overallScore رقم من 0 إلى 100. strengths و misses و discoveredFacts مصفوفات عربية قصيرة من 2 إلى 5 عناصر إن وُجدت. nextStage يجب أن يكون واحداً من: FIRST_OUTREACH, DISCOVERY_CALL, QUALIFICATION_CALL, OFFER_CALL, FOLLOW_UP_CALL, CLOSING_CALL. outcome يجب أن يكون ACTIVE أو WON أو LOST. لا تنقل المرحلة إلا إذا كان transcript يبرر ذلك فعلاً. إذا كانت المكالمة ضعيفة أبقِ نفس المرحلة. historySummary يجب أن يكون ملخصاً قصيراً لما حدث ليستعمل في المكالمة القادمة.',
            },
            {
              role: 'user',
              content:
                `المرحلة الحالية: ${journey.stage}\n` +
                `اسم العميل: ${journey.clientName}\n` +
                `النشاط: ${journey.businessName}\n` +
                `اللهجة: ${journey.dialect}\n` +
                `الخلاصة السابقة: ${journey.historySummary || 'لا يوجد'}\n` +
                `المعلومات المكتشفة سابقاً: ${Array.isArray(journey.discoveredFacts) ? journey.discoveredFacts.join(' | ') : 'لا يوجد'}\n\n` +
                `نص المكالمة:\n${transcriptText}`,
            },
          ],
        });

        review = sanitizeVoiceCallReview(extractJsonObject(reviewText), journey.stage);
      } catch (reviewErr) {
        console.error('Voice Call Review Fallback Error:', reviewErr);
      }
    }

    const mergedFacts = mergeDiscoveredFacts(journey.discoveredFacts, review.discoveredFacts);
    const nextJourneyData = {
      stage: review.outcome === 'ACTIVE' ? review.nextStage : journey.stage,
      status: review.outcome === 'ACTIVE' ? 'ACTIVE' : review.outcome,
      historySummary: review.historySummary,
      discoveredFacts: mergedFacts,
    };

    const [updatedCall, updatedJourney] = await prisma.$transaction([
      prisma.voicePracticeCall.update({
        where: { id: call.id },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          durationSec,
          transcript: transcriptText,
          summary: review.summary,
          score: review.overallScore,
          review,
        },
      }),
      prisma.voicePracticeJourney.update({
        where: { id: journey.id },
        data: nextJourneyData,
        include: {
          calls: {
            orderBy: { createdAt: 'desc' },
            take: 6,
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        journey: buildVoiceJourneyPublicView(updatedJourney),
        call: {
          id: updatedCall.id,
          stage: updatedCall.stage,
          stageLabel: voiceStageLabel(updatedCall.stage),
          summary: updatedCall.summary || '',
          score: updatedCall.score || 0,
          review: updatedCall.review || null,
        },
      },
    });
  } catch (err) {
    console.error('Voice Call Complete Error:', err);
    return error(res, 'فشل إنهاء المكالمة التدريبية', err.statusCode || 500);
  }
};

const getCallAnalyses = async (req, res) => {
  try {
    const analyses = await prisma.callAnalysis.findMany({
      where: req.user.role === 'ADMIN' ? {} : { studentId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { name: true } },
      },
    });

    res.json({ success: true, data: analyses });
  } catch (err) {
    console.error(err);
    return error(res, 'فشل جلب التحليلات الصوتية', 500);
  }
};

module.exports = {
  chatStream,
  analyzeCall,
  reviewProposal,
  getVoiceAvailability,
  listVoiceJourneys,
  createVoiceJourney,
  startVoiceJourneyCall,
  createVoiceJourneySession,
  completeVoiceJourneyCall,
  getCallAnalyses,
  createPracticeSession,
  practiceChat,
};
