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

const prisma = new PrismaClient();

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
      include: { assignedTo: { select: { id: true, name: true } } },
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

const getOne = async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      comments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      history: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      reminders: { orderBy: { dueAt: 'asc' } },
    },
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

  const data = { name, phone, service, source, budget, notes };

  if (status && (req.user.role === 'ADMIN' || existing.assignedToId === req.user.id)) {
    data.status = status;
    data.lostReason = status === 'CLOSED_LOST' ? lostReason || null : null;
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

const deleteLead = async (req, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  return success(res, null, 'تم حذف العميل');
};

module.exports = { getAll, getClaimPolicy, getOne, create, update, claimLead, deleteLead };
