const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');
const { getOpenRouterClientOrThrow, isProviderAuthError } = require('./ai.controller');

const prisma = new PrismaClient();

const DEFAULT_OPENROUTER_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 20;

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const buildLeadContextPayload = (lead) => ({
  id: lead.id,
  name: lead.name,
  phone: lead.phone,
  service: lead.service,
  source: lead.source,
  budget: lead.budget,
  status: lead.status,
  notes: lead.notes,
  aiProfileSummary: lead.aiProfileSummary,
  aiProfileInsights: lead.aiProfileInsights,
});

const buildPublicMessage = (message) => ({
  id: message.id,
  role: message.role === 'USER' ? 'user' : 'assistant',
  content: message.content,
  createdAt: message.createdAt,
});

const getAccessibleLeadForAssistant = async (req, leadId) => {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      phone: true,
      service: true,
      source: true,
      budget: true,
      status: true,
      notes: true,
      assignedToId: true,
      aiProfileSummary: true,
      aiProfileInsights: true,
    },
  });

  if (!lead) {
    return { statusCode: 404, message: 'العميل غير موجود', lead: null };
  }

  if (req.user.role === 'STUDENT' && lead.assignedToId !== req.user.id && lead.status !== 'AVAILABLE') {
    return { statusCode: 403, message: 'غير مصرح بالوصول إلى مساعد هذا العميل', lead: null };
  }

  return { statusCode: 200, message: '', lead };
};

const getConversationWithMessages = async (leadId, userId) =>
  prisma.leadAiConversation.findUnique({
    where: {
      leadId_userId: {
        leadId,
        userId,
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

const getRecentConversationMessages = async (conversationId) => {
  const messages = await prisma.leadAiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
  });

  return messages.reverse();
};

const buildLeadAssistantSystemPrompt = (lead) => {
  const aiInsights =
    lead.aiProfileSummary || lead.aiProfileInsights
      ? `\n\nمعلومات مستخرجة من المكالمات السابقة:\n- الملخص: ${lead.aiProfileSummary || 'لا يوجد'}\n- مؤشرات إضافية: ${
          lead.aiProfileInsights ? JSON.stringify(lead.aiProfileInsights) : 'لا يوجد'
        }`
      : '';

  return (
    'أنت مساعد مبيعات ذكي داخل نظام CRM لطلاب المبيعات. ساعد الطالب على إدارة هذا العميل عمليًا وبأسلوب مباشر ومهني. ' +
    'عند كتابة الرسائل أو العروض، اكتب بالعربية الواضحة الجاهزة للإرسال. ' +
    'إذا طُلب منك إنشاء عرض أو رسالة، قدّم النسخة النهائية أولًا ثم أضف ملاحظات قصيرة فقط عند الحاجة. ' +
    'استفد من سجل المحادثة السابق معك حتى لا تعيد نفس الأسئلة أو الاقتراحات بلا داعٍ. ' +
    'إذا كانت معلومات العميل ناقصة، اذكر بوضوح ما ينقص وما أفضل خطوة تالية.\n\n' +
    'بيانات العميل الحالية:\n' +
    `- الاسم: ${lead.name || 'غير محدد'}\n` +
    `- الهاتف: ${lead.phone || 'غير محدد'}\n` +
    `- الحالة: ${lead.status || 'غير محدد'}\n` +
    `- الخدمة: ${lead.service || 'غير محدد'}\n` +
    `- المصدر: ${lead.source || 'غير محدد'}\n` +
    `- الميزانية: ${lead.budget || 'غير محدد'}\n` +
    `- ملاحظات الملف: ${lead.notes || 'لا توجد'}`
    + aiInsights
  );
};

const getLeadConversation = async (req, res) => {
  const { leadId } = req.params;
  const access = await getAccessibleLeadForAssistant(req, leadId);

  if (!access.lead) {
    return error(res, access.message, access.statusCode);
  }

  const conversation = await getConversationWithMessages(leadId, req.user.id);

  return success(res, {
    leadContext: buildLeadContextPayload(access.lead),
    conversationId: conversation?.id || null,
    messages: (conversation?.messages || []).map(buildPublicMessage),
  });
};

const streamLeadConversation = async (req, res) => {
  const { leadId } = req.params;
  const message = normalizeText(req.body?.message);
  const model = normalizeText(req.body?.model) || DEFAULT_OPENROUTER_TEXT_MODEL;

  if (!message) {
    return error(res, 'الرسالة مطلوبة', 400);
  }

  const access = await getAccessibleLeadForAssistant(req, leadId);
  if (!access.lead) {
    return error(res, access.message, access.statusCode);
  }

  let userMessageRecord = null;

  try {
    const conversation = await prisma.leadAiConversation.upsert({
      where: {
        leadId_userId: {
          leadId,
          userId: req.user.id,
        },
      },
      update: {},
      create: {
        leadId,
        userId: req.user.id,
      },
    });

    userMessageRecord = await prisma.leadAiMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
      },
    });

    const historyMessages = await getRecentConversationMessages(conversation.id);
    const providerMessages = historyMessages.map((item) => ({
      role: item.role === 'USER' ? 'user' : 'assistant',
      content: item.content,
    }));

    const { client } = await getOpenRouterClientOrThrow();
    const stream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: buildLeadAssistantSystemPrompt(access.lead),
        },
        ...providerMessages,
      ],
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    let assistantReply = '';

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (!delta) continue;

      assistantReply += delta;
      res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      if (res.flush) res.flush();
    }

    const finalReply = normalizeText(assistantReply);
    if (finalReply) {
      await prisma.leadAiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: finalReply,
        },
      });
    }

    res.write(`data: ${JSON.stringify({ done: true, userMessageId: userMessageRecord.id })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (err) {
    console.error('Lead AI Chat Error:', err);

    if (!res.headersSent) {
      if (isProviderAuthError(err)) {
        return error(res, 'مفتاح OpenRouter غير صحيح. راجع إعدادات الذكاء الاصطناعي.', 401);
      }

      return error(
        res,
        err.statusCode === 503
          ? 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.'
          : err.message || 'فشل الاتصال بمساعد العميل',
        err.statusCode || 502
      );
    }

    const fallbackText = 'تعذر إكمال الرد هذه المرة. جرّب مرة أخرى بعد لحظة.';
    res.write(`data: ${JSON.stringify({ error: true, message: fallbackText })}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }
};

module.exports = {
  getLeadConversation,
  streamLeadConversation,
};
