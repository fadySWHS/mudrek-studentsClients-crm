const { PrismaClient } = require('@prisma/client');
const { success } = require('../../utils/response');

const prisma = new PrismaClient();

const getDashboardStats = async (req, res) => {
  const [
    totalLeads,
    availableLeads,
    takenLeads,
    closedWon,
    closedLost,
    totalStudents,
    activeStudents,
    overdueReminders,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: 'AVAILABLE' } }),
    prisma.lead.count({ where: { status: { notIn: ['AVAILABLE', 'CLOSED_WON', 'CLOSED_LOST'] } } }),
    prisma.lead.count({ where: { status: 'CLOSED_WON' } }),
    prisma.lead.count({ where: { status: 'CLOSED_LOST' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'STUDENT', active: true } }),
    prisma.reminder.count({ where: { status: 'PENDING', dueAt: { lt: new Date() } } }),
  ]);

  return success(res, {
    leads: { total: totalLeads, available: availableLeads, active: takenLeads, closedWon, closedLost },
    students: { total: totalStudents, active: activeStudents },
    overdueReminders,
  });
};

const getStudentPerformance = async (req, res) => {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', active: true },
    select: { id: true, name: true },
  });

  const stats = await Promise.all(
    students.map(async (s) => {
      const [total, closedWon, closedLost, active] = await Promise.all([
        prisma.lead.count({ where: { assignedToId: s.id } }),
        prisma.lead.count({ where: { assignedToId: s.id, status: 'CLOSED_WON' } }),
        prisma.lead.count({ where: { assignedToId: s.id, status: 'CLOSED_LOST' } }),
        prisma.lead.count({ where: { assignedToId: s.id, status: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } } }),
      ]);
      return { ...s, total, closedWon, closedLost, active };
    })
  );

  return success(res, stats);
};

const getLostReasons = async (req, res) => {
  const lost = await prisma.lead.findMany({
    where: { status: 'CLOSED_LOST', lostReason: { not: null } },
    select: { lostReason: true },
  });

  const counts = lost.reduce((acc, l) => {
    acc[l.lostReason] = (acc[l.lostReason] || 0) + 1;
    return acc;
  }, {});

  return success(res, counts);
};

module.exports = { getDashboardStats, getStudentPerformance, getLostReasons };
