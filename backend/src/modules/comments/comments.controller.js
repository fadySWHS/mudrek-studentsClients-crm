const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');

const prisma = new PrismaClient();

const addComment = async (req, res) => {
  const { commentText } = req.body;
  const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
  if (!lead) return error(res, 'العميل غير موجود', 404);

  if (req.user.role === 'STUDENT' && lead.assignedToId !== req.user.id) {
    return error(res, 'غير مصرح بإضافة تعليق على هذا العميل', 403);
  }

  const comment = await prisma.leadComment.create({
    data: { leadId: req.params.leadId, userId: req.user.id, commentText },
    include: { user: { select: { id: true, name: true } } },
  });

  await prisma.leadHistory.create({
    data: { leadId: req.params.leadId, actorId: req.user.id, actionType: 'COMMENT_ADDED' },
  });

  return success(res, comment, 'تم إضافة التعليق', 201);
};

const deleteComment = async (req, res) => {
  const comment = await prisma.leadComment.findUnique({ where: { id: req.params.commentId } });
  if (!comment) return error(res, 'التعليق غير موجود', 404);

  if (req.user.role !== 'ADMIN' && comment.userId !== req.user.id) {
    return error(res, 'غير مصرح بحذف هذا التعليق', 403);
  }

  await prisma.leadComment.delete({ where: { id: req.params.commentId } });
  return success(res, null, 'تم حذف التعليق');
};

module.exports = { addComment, deleteComment };
