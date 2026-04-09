const { OpenAI } = require('openai');
const { getSetting } = require('../../utils/getSetting');
const { error } = require('../../utils/response');

const chatStream = async (req, res) => {
  const apiKey = await getSetting('OPENROUTER_API_KEY');
  
  if (!apiKey) {
    return error(res, 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.', 503);
  }

  const { messages, leadContext, model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return error(res, 'يجب إرسال مصفوفة الرسائل (messages)', 400);
  }

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey.trim(),
    defaultHeaders: {
      'HTTP-Referer': process.env.FRONTEND_URL || 'https://studentsclients.mudrek.com',
      'X-Title': 'Mudrek AI CRM',
    }
  });

  try {
    let systemPrompt = `أنت مساعد مبيعات ذكي محترف لمساعدة الطلاب على إغلاق الصفقات وإقناع العملاء في نظام مدرك CRM. أجب باحترافية، وقدم نصائح عملية واقتراحات لرسائل أو عروض جاهزة.`;
    
    if (leadContext) {
      systemPrompt += `\n\nأنت الآن تساعد في الرد على عميل محدد. بيانات العميل الحالي:\n` +
                      `- الاسم: ${leadContext.name || 'غير محدد'}\n` +
                      `- الخدمة المطلوبة: ${leadContext.service || 'غير محدد'}\n` +
                      `- الميزانية: ${leadContext.budget || 'غير محدد'}\n` +
                      `- ملاحظات هامة: ${leadContext.notes || 'لا يوجد'}`;
    }

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const stream = await client.chat.completions.create({
      model: model || 'openai/gpt-4o-mini',
      messages: fullMessages,
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
      return error(res, 'فشل الاتصال بخادم الذكاء الاصطناعي', 502);
    } else {
      res.end();
    }
  }
};

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const analyzeCall = async (req, res) => {
  if (!req.file) {
    return error(res, 'لم يتم إرفاق ملف صوتي', 400);
  }

  const openAiKey = await getSetting('OPENAI_API_KEY');
  const openRouterKey = await getSetting('OPENROUTER_API_KEY');

  if (!openAiKey || !openRouterKey) {
    fs.unlinkSync(req.file.path);
    return error(res, 'مفاتيح API غير مهيأة. يرجى تهيئتها من الإعدادات', 503);
  }

  try {
    // 1. Transcribe Audio using OpenAI Whisper
    const openAiClient = new OpenAI({ apiKey: openAiKey.trim() });
    const transcription = await openAiClient.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: 'whisper-1',
      language: 'ar'
    });
    
    const transcriptText = transcription.text;

    // We no longer need the local file
    fs.unlinkSync(req.file.path);

    if (!transcriptText || transcriptText.trim().length < 10) {
      return error(res, 'لا يوجد كلام واضح في المقطع أو المقطع قصير جداً', 400);
    }

    // 2. Grade Transcript using OpenRouter
    const openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: openRouterKey.trim(),
    });

    const completion = await openRouterClient.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'أنت مدير مبيعات محترف ومقيم أداء. مهمتك هي قراءة تفريغ صوتي لمكالمة مبيعات أجراها الطالب، وتقييم أدائه بشكل دقيق. أعد إجابتك بصيغة JSON فقط، بدون أي نصوص خارج الـ JSON. الكائن المطلوب: { "score": 85, "feedback": "شرح مفصل لنقاط القوة وما يجب تحسينه", "objections": "الاعتراضات التي لم يتعامل معها بشكل جيد" }'
        },
        {
          role: 'user',
          content: `تفريغ المكالمة:\n\n${transcriptText}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);

    // 3. Save to Database
    const analysis = await prisma.callAnalysis.create({
      data: {
        studentId: req.user.id,
        score: aiResponse.score || 0,
        transcript: transcriptText,
        feedback: aiResponse.feedback || '',
        durationSec: 0, 
      }
    });

    return res.json({
      success: true,
      data: analysis
    });

  } catch (err) {
    console.error('AI Call Analysis Error:', err);
    // Cleanup if something crashed midway
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return error(res, 'حدث خطأ أثناء تحليل المكالمة', 500);
  }
};

const getCallAnalyses = async (req, res) => {
  try {
    // Only fetch for that specific student, unless admin
    const analyses = await prisma.callAnalysis.findMany({
      where: req.user.role === 'ADMIN' ? {} : { studentId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        student: { select: { name: true } }
      }
    });

    res.json({ success: true, data: analyses });
  } catch (err) {
    console.error(err);
    return error(res, 'فشل جلب التحليلات الصوتية', 500);
  }
};

module.exports = { chatStream, analyzeCall, getCallAnalyses };
