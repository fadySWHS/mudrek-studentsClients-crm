const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');

const prisma = new PrismaClient();

const getMyReminders = async (req, res) => {
  const where = req.user.role === 'ADMIN' ? {} : { createdById: req.user.id };
  const { status } = req.query;
  if (status) where.status = status;

  const reminders = await prisma.reminder.findMany({
    where,
    include: {
      lead: { select: { id: true, name: true, phone: true, status: true } },
    },
    orderBy: { dueAt: 'asc' },
  });
  return success(res, reminders);
};

const create = async (req, res) => {
  const { dueAt, note } = req.body;
  const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
  if (!lead) return error(res, 'العميل غير موجود', 404);

  if (req.user.role === 'STUDENT' && lead.assignedToId !== req.user.id) {
    return error(res, 'غير مصرح بإضافة تذكير لهذا العميل', 403);
  }

  const reminder = await prisma.reminder.create({
    data: { leadId: req.params.leadId, createdById: req.user.id, dueAt: new Date(dueAt), note },
    include: { lead: { select: { id: true, name: true } } },
  });

  await prisma.leadHistory.create({
    data: { leadId: req.params.leadId, actorId: req.user.id, actionType: 'REMINDER_SET', toValue: dueAt },
  });

  return success(res, reminder, 'تم إنشاء التذكير', 201);
};

const markDone = async (req, res) => {
  const reminder = await prisma.reminder.findUnique({ where: { id: req.params.id } });
  if (!reminder) return error(res, 'التذكير غير موجود', 404);

  if (req.user.role !== 'ADMIN' && reminder.createdById !== req.user.id) {
    return error(res, 'غير مصرح', 403);
  }

  const updated = await prisma.reminder.update({
    where: { id: req.params.id },
    data: { status: 'DONE' },
  });
  return success(res, updated, 'تم تحديد التذكير كمنجز');
};

module.exports = { getMyReminders, create, markDone };
