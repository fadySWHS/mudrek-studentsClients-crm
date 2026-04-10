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

const chatStream = async (req, res) => {
  const storedOpenRouterKey = await getSetting('OPENROUTER_API_KEY');
  const apiKey = resolveOpenRouterKey(storedOpenRouterKey);

  if (!apiKey) {
    return error(res, 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.', 503);
  }

  const { messages, leadContext, model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return error(res, 'يجب إرسال مصفوفة الرسائل (messages)', 400);
  }

  const client = createOpenRouterClient(apiKey);

  try {
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
      return error(res, 'فشل الاتصال بخادم الذكاء الاصطناعي', 502);
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

module.exports = { chatStream, analyzeCall, getCallAnalyses };
