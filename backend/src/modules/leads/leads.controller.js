const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');
const notificationService = require('../notifications/notifications.service');
const {
  CLOSED_STATUSES,
  DEFAULT_ACTIVE_LEAD_LIMIT_KEY,
  DEFAULT_BLOCK_AFTER_WON_KEY,
  parseBoolean,
  parseLimit,
  resolveStudentLeadPolicy,
} = require('../../utils/studentLeadPolicy');
const {
  getOpenRouterClientOrThrow,
  completeText,
  extractJsonObject,
  transcribeCall,
  isProviderAuthError,
} = require('../ai/ai.controller');

const prisma = new PrismaClient();

const OPENROUTER_TEXT_MODEL = process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o-mini';
const RELEASE_REQUEST_DECISIONS = new Set(['APPROVED', 'REJECTED']);
const CALL_RECORD_SUGGESTED_STATUSES = new Set([
  'TAKEN',
  'CONTACTED',
  'FOLLOW_UP',
  'QUALIFIED',
  'CLOSED_WON',
  'CLOSED_LOST',
]);

const userMiniSelect = { id: true, name: true };

const leadDetailInclude = {
  assignedTo: { select: userMiniSelect },
  comments: {
    include: { user: { select: userMiniSelect } },
    orderBy: { createdAt: 'desc' },
  },
  history: {
    include: { actor: { select: userMiniSelect } },
    orderBy: { createdAt: 'desc' },
  },
  reminders: { orderBy: { dueAt: 'asc' } },
  releaseRequests: {
    include: {
      student: { select: userMiniSelect },
      reviewedBy: { select: userMiniSelect },
    },
    orderBy: { createdAt: 'desc' },
  },
  callRecords: {
    include: {
      uploadedBy: { select: userMiniSelect },
    },
    orderBy: { createdAt: 'desc' },
  },
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeArray = (value, maxItems = 5) =>
  Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean).slice(0, maxItems)
    : [];

const normalizePhone = (value) => normalizeText(value).replace(/(?!^\+)[^\d]/g, '');

const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const sanitizeLeadCallProfile = (value = {}) => {
  const suggestedStatus = normalizeText(value?.suggestedStatus).toUpperCase();

  return {
    summary: normalizeText(value?.summary) || 'تم رفع تسجيل المكالمة واستخراج ملخص مختصر لها.',
    discoveredFacts: normalizeArray(value?.discoveredFacts),
    needs: normalizeArray(value?.needs),
    objections: normalizeArray(value?.objections),
    serviceHint: normalizeText(value?.serviceHint),
    budgetSignals: normalizeText(value?.budgetSignals),
    decisionTimeline: normalizeText(value?.decisionTimeline),
    decisionMaker: normalizeText(value?.decisionMaker),
    sentiment: normalizeText(value?.sentiment),
    recommendedNextStep: normalizeText(value?.recommendedNextStep),
    suggestedStatus: CALL_RECORD_SUGGESTED_STATUSES.has(suggestedStatus) ? suggestedStatus : null,
  };
};

const buildLeadAiProfileInsights = (profile, callRecordId) => ({
  discoveredFacts: profile.discoveredFacts,
  needs: profile.needs,
  objections: profile.objections,
  serviceHint: profile.serviceHint,
  budgetSignals: profile.budgetSignals,
  decisionTimeline: profile.decisionTimeline,
  decisionMaker: profile.decisionMaker,
  sentiment: profile.sentiment,
  recommendedNextStep: profile.recommendedNextStep,
  suggestedStatus: profile.suggestedStatus,
  lastCallRecordId: callRecordId,
  updatedAt: new Date().toISOString(),
});

const sanitizeLeadIntakeFromText = (value = {}) => ({
  name: normalizeText(value?.name),
  phone: normalizePhone(value?.phone),
  service: normalizeText(value?.service),
  source: normalizeText(value?.source),
  budget: normalizeText(value?.budget),
  notes: normalizeText(value?.notes),
  missingFields: normalizeArray(value?.missingFields),
});

const buildLeadNotesFromTextIntake = (rawText, extractedNotes) => {
  const cleanedRawText = normalizeText(rawText);
  const cleanedNotes = normalizeText(extractedNotes);
  const parts = [];

  if (cleanedNotes) {
    parts.push(cleanedNotes);
  }

  if (cleanedRawText) {
    parts.push(`النص الخام:\n${cleanedRawText}`);
  }

  return parts.join('\n\n') || null;
};

const extractLeadDataFromText = async (rawText) => {
  const { client } = await getOpenRouterClientOrThrow();

  const extractionText = await completeText(client, {
    model: OPENROUTER_TEXT_MODEL,
    temperature: 0.15,
    messages: [
      {
        role: 'system',
        content:
          'أنت مساعد CRM يستخرج بيانات عميل جديد من رسالة غير مرتبة أو وصف حر. أعد JSON فقط بدون أي شرح إضافي وبالمفاتيح التالية فقط: name, phone, service, source, budget, notes, missingFields. استخدم نصًا عربيًا قصيرًا وواضحًا. إذا كانت المعلومة غير موجودة فاجعل قيمتها سلسلة فارغة. missingFields مصفوفة بأسماء الحقول المهمة غير الموجودة من بين: name, phone, service, source, budget. لا تخترع أي بيانات غير مذكورة صراحة أو غير مفهومة بوضوح. notes يجب أن تكون ملخصًا عمليًا قصيرًا لما فهمته عن العميل واحتياجه.',
      },
      {
        role: 'user',
        content: `استخرج بيانات العميل من النص التالي:\n"""\n${rawText}\n"""`,
      },
    ],
  });

  return sanitizeLeadIntakeFromText(extractJsonObject(extractionText));
};

const getStudentScopedWhere = (req) => {
  const filters = [];
  const { status, assignedTo, search } = req.query;

  if (req.user.role === 'STUDENT') {
    if (assignedTo) {
      filters.push({ assignedToId: req.user.id });
    } else {
      filters.push({
        OR: [{ status: 'AVAILABLE' }, { assignedToId: req.user.id }],
      });
    }
  } else if (assignedTo) {
    filters.push({ assignedToId: assignedTo });
  }

  if (status) {
    filters.push({ status });
  }

  if (search?.trim()) {
    filters.push({
      OR: [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim() } },
      ],
    });
  }

  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0];

  return { AND: filters };
};

const resolveStudentLeadPolicyWithTx = async (tx, studentId) => {
  const [student, settings, activeLeadCount, closedWonCount] = await Promise.all([
    tx.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        leadReservationLimitOverride: true,
        blockNewLeadsAfterWonOverride: true,
      },
    }),
    tx.systemSetting.findMany({
      where: {
        key: {
          in: [DEFAULT_ACTIVE_LEAD_LIMIT_KEY, DEFAULT_BLOCK_AFTER_WON_KEY],
        },
      },
      select: { key: true, value: true },
    }),
    tx.lead.count({
      where: {
        assignedToId: studentId,
        status: { notIn: CLOSED_STATUSES },
      },
    }),
    tx.lead.count({
      where: {
        assignedToId: studentId,
        status: 'CLOSED_WON',
      },
    }),
  ]);

  if (!student || student.role !== 'STUDENT') return null;

  const settingsMap = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const defaultActiveLeadLimit = parseLimit(settingsMap[DEFAULT_ACTIVE_LEAD_LIMIT_KEY], 0);
  const defaultBlockNewLeadsAfterWon = parseBoolean(settingsMap[DEFAULT_BLOCK_AFTER_WON_KEY], false);

  const activeLeadReservationLimit = student.leadReservationLimitOverride ?? defaultActiveLeadLimit;
  const blockNewLeadsAfterWon = student.blockNewLeadsAfterWonOverride ?? defaultBlockNewLeadsAfterWon;
  const hasSuccessfulDeal = closedWonCount > 0;

  return {
    activeLeadCount,
    activeLeadReservationLimit,
    blockNewLeadsAfterWon,
    hasSuccessfulDeal,
    isBlockedByLimit:
      activeLeadReservationLimit > 0 && activeLeadCount >= activeLeadReservationLimit,
    isBlockedBySuccessfulDeal: blockNewLeadsAfterWon && hasSuccessfulDeal,
  };
};

const getAll = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const where = getStudentScopedWhere(req);

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { assignedTo: { select: userMiniSelect } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit, 10),
    }),
    prisma.lead.count({ where }),
  ]);

  return success(res, { leads, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
};

const getClaimPolicy = async (req, res) => {
  if (req.user.role !== 'STUDENT') {
    return success(res, {
      canClaimNewLeads: true,
      reason: null,
    });
  }

  return success(res, await resolveStudentLeadPolicy(req.user.id));
};

const listPendingReleaseRequests = async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10) || 10, 1), 50);

  const [requests, total] = await Promise.all([
    prisma.leadReleaseRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        student: { select: userMiniSelect },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            service: true,
            assignedToId: true,
            assignedTo: { select: userMiniSelect },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.leadReleaseRequest.count({
      where: { status: 'PENDING' },
    }),
  ]);

  return success(res, {
    requests,
    total,
  });
};

const getOne = async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: leadDetailInclude,
  });

  if (!lead) return error(res, 'العميل غير موجود', 404);
  if (req.user.role === 'STUDENT' && lead.assignedToId !== req.user.id && lead.status !== 'AVAILABLE') {
    return error(res, 'غير مصرح بالوصول لهذا العميل', 403);
  }

  return success(res, lead);
};

const create = async (req, res) => {
  const { name, phone, service, source, budget, notes } = req.body;
  const lead = await prisma.lead.create({
    data: { name, phone, service, source, budget, notes, status: 'AVAILABLE' },
  });

  await prisma.leadHistory.create({
    data: { leadId: lead.id, actorId: req.user.id, actionType: 'CREATED', toValue: 'AVAILABLE' },
  });

  return success(res, lead, 'تم إنشاء العميل بنجاح', 201);
};

const createFromText = async (req, res) => {
  const rawText = normalizeText(req.body?.text);

  if (!rawText) {
    return error(res, 'النص المطلوب لتحليل العميل غير موجود', 400);
  }

  try {
    const extractedLead = await extractLeadDataFromText(rawText);
    const missingRequiredFields = ['name', 'phone'].filter((field) => !extractedLead[field]);

    if (missingRequiredFields.length > 0) {
      return error(
        res,
        `تعذر إنشاء العميل لأن الذكاء الاصطناعي لم يستخرج ${missingRequiredFields.join(' و ')} بشكل واضح من النص.`,
        400
      );
    }

    const lead = await prisma.lead.create({
      data: {
        name: extractedLead.name,
        phone: extractedLead.phone,
        service: extractedLead.service || null,
        source: extractedLead.source || null,
        budget: extractedLead.budget || null,
        notes: buildLeadNotesFromTextIntake(rawText, extractedLead.notes),
        status: 'AVAILABLE',
      },
    });

    await prisma.leadHistory.create({
      data: { leadId: lead.id, actorId: req.user.id, actionType: 'CREATED', toValue: 'AVAILABLE' },
    });

    return success(res, lead, 'تم إنشاء العميل من النص الحر بنجاح', 201);
  } catch (err) {
    if (isProviderAuthError(err)) {
      return error(res, 'مفتاح OpenRouter غير صحيح. راجع إعدادات الذكاء الاصطناعي.', 401);
    }

    return error(
      res,
      err.statusCode === 503
        ? 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات أولًا.'
        : err.message || 'فشل تحليل النص وإنشاء العميل',
      err.statusCode || 502
    );
  }
};

const update = async (req, res) => {
  const {
    name,
    phone,
    service,
    source,
    budget,
    notes,
    lostReason,
    status,
    assignedToId,
  } = req.body;

  const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!existing) return error(res, 'العميل غير موجود', 404);

  if (req.user.role === 'STUDENT' && existing.assignedToId !== req.user.id) {
    return error(res, 'غير مصرح بتعديل هذا العميل', 403);
  }

  if (req.user.role === 'STUDENT' && Object.prototype.hasOwnProperty.call(req.body, 'assignedToId')) {
    return error(res, 'الطالب لا يمكنه تغيير تعيين العميل', 403);
  }

  const data = { name, phone, service, source, budget, notes };

  if (status && (req.user.role === 'ADMIN' || existing.assignedToId === req.user.id)) {
    if (req.user.role === 'STUDENT' && status === 'AVAILABLE') {
      return error(res, 'لا يمكنك إعادة العميل إلى المتاح مباشرة. أرسل طلب مراجعة للإدارة أولاً.', 409);
    }

    data.status = status;
    data.lostReason = status === 'CLOSED_LOST' ? lostReason || null : null;

    if (req.user.role === 'ADMIN' && status === 'AVAILABLE') {
      data.assignedToId = null;
    }
  }

  if (req.user.role === 'ADMIN' && Object.prototype.hasOwnProperty.call(req.body, 'assignedToId')) {
    data.assignedToId = assignedToId || null;

    if (!status) {
      if (assignedToId && existing.status === 'AVAILABLE') data.status = 'TAKEN';
      if (!assignedToId && existing.status === 'TAKEN') data.status = 'AVAILABLE';
    }
  }

  const lead = await prisma.lead.update({ where: { id: req.params.id }, data });

  if (lead.status !== existing.status) {
    await prisma.leadHistory.create({
      data: {
        leadId: lead.id,
        actorId: req.user.id,
        actionType: 'STATUS_CHANGE',
        fromValue: existing.status,
        toValue: lead.status,
      },
    });
  }

  if (lead.assignedToId !== existing.assignedToId) {
    await prisma.leadHistory.create({
      data: {
        leadId: lead.id,
        actorId: req.user.id,
        actionType: 'ASSIGNED',
        fromValue: existing.assignedToId || null,
        toValue: lead.assignedToId || null,
      },
    });
  }

  return success(res, lead, 'تم تحديث بيانات العميل');
};

const claimLead = async (req, res) => {
  if (req.user.role !== 'STUDENT') {
    return error(res, 'هذا الإجراء مخصص للطلاب فقط', 403);
  }

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const policy = await resolveStudentLeadPolicyWithTx(tx, req.user.id);
      if (!policy) throw { status: 403, message: 'هذا الإجراء مخصص للطلاب فقط' };

      if (policy.isBlockedBySuccessfulDeal) {
        throw {
          status: 403,
          message: 'تم إيقاف حجز عملاء جدد لهذا الحساب بعد تسجيل صفقة ناجحة.',
        };
      }

      if (policy.isBlockedByLimit) {
        throw {
          status: 403,
          message: `وصلت إلى الحد الأقصى لحجز العملاء (${policy.activeLeadCount}/${policy.activeLeadReservationLimit}).`,
        };
      }

      const found = await tx.lead.findUnique({ where: { id: req.params.id } });
      if (!found) throw { status: 404, message: 'العميل غير موجود' };
      if (found.status !== 'AVAILABLE') throw { status: 409, message: 'تم أخذ هذا العميل بالفعل' };

      return tx.lead.update({
        where: { id: req.params.id },
        data: { status: 'TAKEN', assignedToId: req.user.id },
      });
    });

    await prisma.leadHistory.create({
      data: { leadId: lead.id, actorId: req.user.id, actionType: 'CLAIMED', toValue: req.user.id },
    });

    notificationService.notifyLeadClaimed(lead, req.user).catch(() => {});

    return success(res, lead, 'تم أخذ العميل بنجاح');
  } catch (err) {
    if (err?.status) return error(res, err.message, err.status);
    throw err;
  }
};

const requestLeadRelease = async (req, res) => {
  if (req.user.role !== 'STUDENT') {
    return error(res, 'هذا الإجراء مخصص للطلاب فقط', 403);
  }

  const studentNote = normalizeText(req.body?.studentNote);

  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: { assignedTo: { select: userMiniSelect } },
  });

  if (!lead) return error(res, 'العميل غير موجود', 404);
  if (lead.assignedToId !== req.user.id) {
    return error(res, 'لا يمكنك طلب إعادة عميل غير مخصص لك', 403);
  }

  if (CLOSED_STATUSES.includes(lead.status)) {
    return error(res, 'هذا العميل مغلق بالفعل ولا يحتاج إلى إعادة للمتاح', 400);
  }

  const existingPendingRequest = await prisma.leadReleaseRequest.findFirst({
    where: {
      leadId: lead.id,
      studentId: req.user.id,
      status: 'PENDING',
    },
  });

  if (existingPendingRequest) {
    return error(res, 'يوجد طلب مراجعة مفتوح لهذا العميل بالفعل', 409);
  }

  const releaseRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.leadReleaseRequest.create({
      data: {
        leadId: lead.id,
        studentId: req.user.id,
        studentNote: studentNote || null,
      },
      include: {
        student: { select: userMiniSelect },
        reviewedBy: { select: userMiniSelect },
      },
    });

    await tx.leadHistory.create({
      data: {
        leadId: lead.id,
        actorId: req.user.id,
        actionType: 'RELEASE_REQUESTED',
        toValue: created.id,
      },
    });

    return created;
  });

  notificationService.notifyLeadReleaseRequested(lead, req.user, studentNote).catch(() => {});

  return success(res, releaseRequest, 'تم إرسال طلب مراجعة إعادة العميل للإدارة', 201);
};

const reviewLeadReleaseRequest = async (req, res) => {
  const decision = normalizeText(req.body?.decision).toUpperCase();
  const adminNote = normalizeText(req.body?.adminNote);

  if (!RELEASE_REQUEST_DECISIONS.has(decision)) {
    return error(res, 'قرار المراجعة غير صالح', 400);
  }

  const releaseRequest = await prisma.leadReleaseRequest.findFirst({
    where: {
      id: req.params.requestId,
      leadId: req.params.id,
    },
    include: {
      lead: true,
      student: { select: userMiniSelect },
      reviewedBy: { select: userMiniSelect },
    },
  });

  if (!releaseRequest) return error(res, 'طلب المراجعة غير موجود', 404);
  if (releaseRequest.status !== 'PENDING') {
    return error(res, 'تمت مراجعة هذا الطلب بالفعل', 409);
  }

  if (decision === 'APPROVED' && releaseRequest.lead.assignedToId !== releaseRequest.studentId) {
    return error(res, 'تغيّرت حالة العميل قبل الموافقة. حدّث الصفحة ثم راجع الحالة الحالية.', 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.leadReleaseRequest.update({
      where: { id: releaseRequest.id },
      data: {
        status: decision,
        adminNote: adminNote || null,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      },
      include: {
        student: { select: userMiniSelect },
        reviewedBy: { select: userMiniSelect },
      },
    });

    if (decision === 'APPROVED') {
      const updatedLead = await tx.lead.update({
        where: { id: releaseRequest.leadId },
        data: {
          status: 'AVAILABLE',
          assignedToId: null,
          lostReason: null,
        },
      });

      if (updatedLead.status !== releaseRequest.lead.status) {
        await tx.leadHistory.create({
          data: {
            leadId: updatedLead.id,
            actorId: req.user.id,
            actionType: 'STATUS_CHANGE',
            fromValue: releaseRequest.lead.status,
            toValue: updatedLead.status,
          },
        });
      }

      if (updatedLead.assignedToId !== releaseRequest.lead.assignedToId) {
        await tx.leadHistory.create({
          data: {
            leadId: updatedLead.id,
            actorId: req.user.id,
            actionType: 'ASSIGNED',
            fromValue: releaseRequest.lead.assignedToId || null,
            toValue: updatedLead.assignedToId || null,
          },
        });
      }
    }

    await tx.leadHistory.create({
      data: {
        leadId: releaseRequest.leadId,
        actorId: req.user.id,
        actionType: decision === 'APPROVED' ? 'RELEASE_APPROVED' : 'RELEASE_REJECTED',
        fromValue: releaseRequest.studentId,
        toValue: updatedRequest.id,
      },
    });

    return updatedRequest;
  });

  return success(
    res,
    result,
    decision === 'APPROVED' ? 'تمت الموافقة على إعادة العميل إلى المتاح' : 'تم رفض طلب إعادة العميل'
  );
};

const addLeadCallRecord = async (req, res) => {
  if (!req.file) {
    return error(res, 'لم يتم إرفاق ملف صوتي', 400);
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) return error(res, 'العميل غير موجود', 404);

    if (req.user.role === 'STUDENT' && lead.assignedToId !== req.user.id) {
      return error(res, 'لا يمكنك إضافة تسجيل مكالمة لهذا العميل', 403);
    }

    const { apiKey, client } = await getOpenRouterClientOrThrow();
    const transcriptText = await transcribeCall(req.file, '', '', apiKey);

    if (!transcriptText || transcriptText.trim().length < 10) {
      return error(res, 'لا يوجد كلام واضح كفاية في التسجيل لتحليله', 400);
    }

    const profileText = await completeText(client, {
      model: OPENROUTER_TEXT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'أنت محلل CRM يحول مكالمة عميل إلى بيانات عملية داخل الملف. أعد JSON فقط بدون أي شرح إضافي وبالمفاتيح التالية فقط: summary, discoveredFacts, needs, objections, serviceHint, budgetSignals, decisionTimeline, decisionMaker, sentiment, recommendedNextStep, suggestedStatus. summary فقرة عربية قصيرة من 2 إلى 4 جمل. discoveredFacts و needs و objections مصفوفات عربية قصيرة من 0 إلى 5 عناصر. serviceHint و budgetSignals و decisionTimeline و decisionMaker و sentiment و recommendedNextStep نصوص عربية قصيرة ويمكن أن تكون فارغة. suggestedStatus يجب أن يكون واحدا من: TAKEN, CONTACTED, FOLLOW_UP, QUALIFIED, CLOSED_WON, CLOSED_LOST. إذا لم يتضح شيء فاجعل suggestedStatus = TAKEN.',
        },
        {
          role: 'user',
          content:
            `بيانات العميل الحالية:\n` +
            `الاسم: ${lead.name}\n` +
            `الهاتف: ${lead.phone}\n` +
            `الخدمة الحالية: ${lead.service || 'غير محددة'}\n` +
            `الميزانية الحالية: ${lead.budget || 'غير محددة'}\n` +
            `الحالة الحالية: ${lead.status}\n` +
            `ملاحظات الملف: ${lead.notes || 'لا توجد'}\n\n` +
            `تفريغ المكالمة:\n${transcriptText}`,
        },
      ],
    });

    const parsedProfile = sanitizeLeadCallProfile(extractJsonObject(profileText));

    const result = await prisma.$transaction(async (tx) => {
      const callRecord = await tx.leadCallRecord.create({
        data: {
          leadId: lead.id,
          uploadedById: req.user.id,
          fileName: req.file.originalname || null,
          transcript: transcriptText,
          summary: parsedProfile.summary,
          extractedProfile: parsedProfile,
          nextStep: parsedProfile.recommendedNextStep || null,
          suggestedStatus: parsedProfile.suggestedStatus || null,
        },
        include: {
          uploadedBy: { select: userMiniSelect },
        },
      });

      const aiProfileInsights = buildLeadAiProfileInsights(parsedProfile, callRecord.id);
      const leadUpdateData = {
        aiProfileSummary: parsedProfile.summary,
        aiProfileInsights,
      };

      if (!lead.service && parsedProfile.serviceHint) {
        leadUpdateData.service = parsedProfile.serviceHint;
      }

      if (!lead.budget && parsedProfile.budgetSignals) {
        leadUpdateData.budget = parsedProfile.budgetSignals;
      }

      await tx.lead.update({
        where: { id: lead.id },
        data: leadUpdateData,
      });

      await tx.leadHistory.create({
        data: {
          leadId: lead.id,
          actorId: req.user.id,
          actionType: 'CALL_RECORD_ADDED',
          toValue: callRecord.id,
        },
      });

      return callRecord;
    });

    return success(res, result, 'تمت إضافة تسجيل المكالمة وتحليلها', 201);
  } catch (err) {
    if (isProviderAuthError(err)) {
      return error(res, 'مفتاح OpenRouter غير صحيح. راجع إعدادات الذكاء الاصطناعي.', 401);
    }

    return error(
      res,
      err.statusCode === 503
        ? 'مفتاح OpenRouter غير متوفر. يرجى تهيئته من الإعدادات.'
        : err.message || 'فشل تحليل تسجيل المكالمة',
      err.statusCode || 502
    );
  } finally {
    cleanupTempFile(req.file?.path);
  }
};

const deleteLead = async (req, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  return success(res, null, 'تم حذف العميل');
};

module.exports = {
  getAll,
  getClaimPolicy,
  listPendingReleaseRequests,
  getOne,
  create,
  createFromText,
  update,
  claimLead,
  requestLeadRelease,
  reviewLeadReleaseRequest,
  addLeadCallRecord,
  deleteLead,
};
