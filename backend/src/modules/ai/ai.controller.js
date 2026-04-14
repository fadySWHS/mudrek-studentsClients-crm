const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const { OpenAI } = require('openai');
const { getSetting } = require('../../utils/getSetting');
const { error } = require('../../utils/response');

const prisma = new PrismaClient();

const DEFAULT_OPENROUTER_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o-mini';
const DEFAULT_OPENROUTER_AUDIO_MODEL = process.env.OPENROUTER_AUDIO_MODEL || 'openai/gpt-audio-mini';
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

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

const normalize = (value) => (typeof value === 'string' ? value.trim() : '');
const isOpenRouterKey = (value) => normalize(value).startsWith('sk-or-v1');
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

const createOpenRouterClient = (apiKey) =>
  new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.FRONTEND_URL || 'https://studentsclients.mudrek.com',
      'X-Title': 'Mudrek AI CRM',
    },
  });

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
});

const sanitizePracticeSession = (session, blueprint) => ({
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
  difficulty: normalize(session?.difficulty) || blueprint.difficulty,
  goals: Array.isArray(session?.goals) ? session.goals.map(normalize).filter(Boolean).slice(0, 4) : [],
  painPoints: Array.isArray(session?.painPoints) ? session.painPoints.map(normalize).filter(Boolean).slice(0, 4) : [],
  objections: Array.isArray(session?.objections) ? session.objections.map(normalize).filter(Boolean).slice(0, 4) : [],
  hiddenContext: Array.isArray(session?.hiddenContext) ? session.hiddenContext.map(normalize).filter(Boolean).slice(0, 4) : [],
  openingMessage: normalize(session?.openingMessage) || 'أهلاً، أنا مهتم أعرف كيف ممكن تساعدني بخدمة رقمية تناسب شغلي.',
});

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
            'You generate Arabic roleplay scenarios for sales students. Return one JSON object only with no markdown, no explanation, and no extra text. The JSON keys must be exactly: clientName, clientRole, businessName, industry, location, businessSummary, companySize, digitalMaturity, targetService, mainNeed, budgetRange, urgency, personality, communicationStyle, openingMood, difficulty, goals, painPoints, objections, hiddenContext, openingMessage. All values must be Arabic except proper business names if needed. Arrays must contain 2 to 4 short Arabic strings. Make the scenario realistic, specific, and naturally varied.',
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
            `- حجم النشاط: ${blueprint.companySize}\n\n` +
            'أريد سيناريو يبدأ وكأن العميل الحقيقي فتح المحادثة بنفسه ويحتاج أن يقيّمني كمزوّد خدمة ومندوب مبيعات في نفس الوقت.',
        },
      ],
    });

    const parsed = extractJsonObject(responseText);
    const session = sanitizePracticeSession(parsed, blueprint);

    return res.json({ success: true, data: session });
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
  const { messages, session } = req.body || {};

  if (!session || typeof session !== 'object') {
    return error(res, 'بيانات جلسة العميل مطلوبة', 400);
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
    const safeSession = sanitizePracticeSession(session, buildPracticeSessionBlueprint());
    const reply = await completeText(client, {
      model: DEFAULT_OPENROUTER_TEXT_MODEL,
      temperature: 0.95,
      messages: [
        {
          role: 'system',
          content:
            'أنت الآن تمثل عميلاً محتملاً حقيقياً داخل تدريب مبيعات. ابقَ داخل الشخصية دائماً ولا تتحول إلى مدرب أو مساعد أو شارح. تحدث بالعربية الطبيعية فقط. يجب أن تتصرف حسب الملف التالي بدقة، مع كشف المعلومات تدريجياً مثل عميل حقيقي، ومع الحفاظ على الاعتراضات والشخصية ونبرة الحديث. لا تكتب أي تنسيق خاص أو قوائم إلا إذا طلب منك الطالب ذلك بشكل مباشر. اجعل ردك من جملتين إلى خمس جمل كحد أقصى، وكن واقعياً: قد تتحمس، قد تعترض، قد تسأل، وقد تطلب إثباتاً أو أمثلة، لكن لا توافق بسهولة غير منطقية.\n\n' +
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
  getCallAnalyses,
  createPracticeSession,
  practiceChat,
};
