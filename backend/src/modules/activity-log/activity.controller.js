const { PrismaClient } = require('@prisma/client');
const { success } = require('../../utils/response');

const prisma = new PrismaClient();

const getLog = async (req, res) => {
  const { leadId, userId, page = 1, limit = 50 } = req.query;
  const where = {};
  if (leadId) where.leadId = leadId;
  if (userId) where.actorId = userId;

  const [history, total] = await Promise.all([
    prisma.leadHistory.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true } },
        actor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
    }),
    prisma.leadHistory.count({ where }),
  ]);

  return success(res, { history, total, page: parseInt(page) });
};

module.exports = { getLog };
