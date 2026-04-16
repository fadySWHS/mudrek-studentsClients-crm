const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_ACTIVE_LEAD_LIMIT_KEY = 'DEFAULT_STUDENT_ACTIVE_LEAD_LIMIT';
const DEFAULT_BLOCK_AFTER_WON_KEY = 'DEFAULT_BLOCK_NEW_LEADS_AFTER_WON';
const CLOSED_STATUSES = ['CLOSED_WON', 'CLOSED_LOST'];

const parseLimit = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return parsed;
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;

  return fallback;
};

const buildBlockReason = ({ isBlockedBySuccessfulDeal, isBlockedByLimit, activeLeadCount, activeLeadReservationLimit }) => {
  if (isBlockedBySuccessfulDeal) {
    return 'تم إيقاف حجز عملاء جدد لهذا الطالب بعد تسجيل صفقة ناجحة.';
  }

  if (isBlockedByLimit && activeLeadReservationLimit > 0) {
    return `وصلت إلى الحد الأقصى لحجز العملاء (${activeLeadCount}/${activeLeadReservationLimit}).`;
  }

  return null;
};

const resolveStudentLeadPolicy = async (studentId) => {
  const [student, settings, activeLeadCount, closedWonCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        role: true,
        leadReservationLimitOverride: true,
        blockNewLeadsAfterWonOverride: true,
      },
    }),
    prisma.systemSetting.findMany({
      where: {
        key: {
          in: [DEFAULT_ACTIVE_LEAD_LIMIT_KEY, DEFAULT_BLOCK_AFTER_WON_KEY],
        },
      },
      select: { key: true, value: true },
    }),
    prisma.lead.count({
      where: {
        assignedToId: studentId,
        status: { notIn: CLOSED_STATUSES },
      },
    }),
    prisma.lead.count({
      where: {
        assignedToId: studentId,
        status: 'CLOSED_WON',
      },
    }),
  ]);

  if (!student || student.role !== 'STUDENT') {
    return null;
  }

  const settingsMap = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));

  const defaultActiveLeadLimit = parseLimit(settingsMap[DEFAULT_ACTIVE_LEAD_LIMIT_KEY], 0);
  const defaultBlockNewLeadsAfterWon = parseBoolean(settingsMap[DEFAULT_BLOCK_AFTER_WON_KEY], false);

  const activeLeadReservationLimit = student.leadReservationLimitOverride ?? defaultActiveLeadLimit;
  const blockNewLeadsAfterWon = student.blockNewLeadsAfterWonOverride ?? defaultBlockNewLeadsAfterWon;
  const hasSuccessfulDeal = closedWonCount > 0;

  const isBlockedByLimit =
    activeLeadReservationLimit > 0 && activeLeadCount >= activeLeadReservationLimit;
  const isBlockedBySuccessfulDeal = blockNewLeadsAfterWon && hasSuccessfulDeal;
  const canClaimNewLeads = !isBlockedByLimit && !isBlockedBySuccessfulDeal;
  const remainingClaims =
    activeLeadReservationLimit > 0
      ? Math.max(activeLeadReservationLimit - activeLeadCount, 0)
      : null;

  return {
    canClaimNewLeads,
    reason: buildBlockReason({
      isBlockedBySuccessfulDeal,
      isBlockedByLimit,
      activeLeadCount,
      activeLeadReservationLimit,
    }),
    activeLeadCount,
    activeLeadReservationLimit,
    remainingClaims,
    hasSuccessfulDeal,
    blockNewLeadsAfterWon,
    defaultActiveLeadLimit,
    defaultBlockNewLeadsAfterWon,
    usesDefaultLimit: student.leadReservationLimitOverride === null,
    usesDefaultBlockAfterWon: student.blockNewLeadsAfterWonOverride === null,
    isBlockedByLimit,
    isBlockedBySuccessfulDeal,
    overrides: {
      leadReservationLimitOverride: student.leadReservationLimitOverride,
      blockNewLeadsAfterWonOverride: student.blockNewLeadsAfterWonOverride,
    },
  };
};

module.exports = {
  DEFAULT_ACTIVE_LEAD_LIMIT_KEY,
  DEFAULT_BLOCK_AFTER_WON_KEY,
  CLOSED_STATUSES,
  parseLimit,
  parseBoolean,
  resolveStudentLeadPolicy,
};
