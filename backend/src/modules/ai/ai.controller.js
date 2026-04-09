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

module.exports = { chatStream };
