const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');
const notificationService = require('../notifications/notifications.service');

const prisma = new PrismaClient();

const getAll = async (req, res) => {
  const { status, assignedTo, search, page = 1, limit = 20 } = req.query;
  const where = {};

  if (req.user.role === 'STUDENT') {
    where.OR = [{ status: 'AVAILABLE' }, { assignedToId: req.user.id }];
  }

  if (status) where.status = status;
  if (assignedTo && req.user.role === 'ADMIN') where.assignedToId = assignedTo;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    prisma.lead.count({ where }),
  ]);

  return success(res, { leads, total, page: parseInt(page), limit: parseInt(limit) });
};

const getOne = async (req, res) => {
  const where = { id: req.params.id };
  const lead = await prisma.lead.findUnique({
    where,
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
  const { name, phone, service, source, budget, notes, lostReason, status } = req.body;
  const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });
  if (!existing) return error(res, 'العميل غير موجود', 404);

  if (req.user.role === 'STUDENT' && existing.assignedToId !== req.user.id) {
    return error(res, 'غير مصرح بتعديل هذا العميل', 403);
  }

  const data = { name, phone, service, source, budget, notes };
  if (status && (req.user.role === 'ADMIN' || existing.assignedToId === req.user.id)) {
    data.status = status;
    if (status === 'CLOSED_LOST' && lostReason) data.lostReason = lostReason;
  }

  const lead = await prisma.lead.update({ where: { id: req.params.id }, data });

  if (status && status !== existing.status) {
    await prisma.leadHistory.create({
      data: { leadId: lead.id, actorId: req.user.id, actionType: 'STATUS_CHANGE', fromValue: existing.status, toValue: status },
    });
  }

  return success(res, lead, 'تم تحديث بيانات العميل');
};

// Atomic lead claim — prevents race conditions
const claimLead = async (req, res) => {
  const lead = await prisma.$transaction(async (tx) => {
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

  // Fire WhatsApp notification (non-blocking)
  notificationService.notifyLeadClaimed(lead, req.user).catch(() => {});

  return success(res, lead, 'تم أخذ العميل بنجاح');
};

const deleteLead = async (req, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  return success(res, null, 'تم حذف العميل');
};

module.exports = { getAll, getOne, create, update, claimLead, deleteLead };
