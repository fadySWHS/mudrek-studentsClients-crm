const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { success, error } = require('../../utils/response');
const { getSetting } = require('../../utils/getSetting');
const { resolveStudentLeadPolicy } = require('../../utils/studentLeadPolicy');

const prisma = new PrismaClient();

const parseNullableLimitOverride = (value) => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: 'حد حجز العملاء يجب أن يكون رقماً صحيحاً أكبر من أو يساوي 0' };
  }

  return parsed;
};

const parseNullableBooleanOverride = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;

  return { error: 'قيمة منع أخذ عملاء جدد بعد الصفقة الناجحة غير صالحة' };
};

const baseUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  sourceStudentId: true,
  leadReservationLimitOverride: true,
  blockNewLeadsAfterWonOverride: true,
  createdAt: true,
};

const withStudentPolicy = async (user) => {
  if (!user || user.role !== 'STUDENT') return user;

  return {
    ...user,
    leadPolicy: await resolveStudentLeadPolicy(user.id),
  };
};

const withStudentPolicies = async (users) => {
  return Promise.all(users.map(withStudentPolicy));
};

const getAll = async (req, res) => {
  const { role, page = 1, limit = 20, search } = req.query;
  const where = {};

  if (role) where.role = role;
  if (search?.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
      { email: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: baseUserSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit, 10),
    }),
    prisma.user.count({ where }),
  ]);

  return success(res, {
    users: await withStudentPolicies(users),
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });
};

const getOne = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: baseUserSelect,
  });

  if (!user) return error(res, 'المستخدم غير موجود', 404);
  return success(res, await withStudentPolicy(user));
};

const create = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    leadReservationLimitOverride,
    blockNewLeadsAfterWonOverride,
  } = req.body;

  if (!name || !email || !password) {
    return error(res, 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة', 400);
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return error(res, 'البريد الإلكتروني مستخدم بالفعل', 409);

  const nextRole = role || 'STUDENT';
  const normalizedLimitOverride = parseNullableLimitOverride(leadReservationLimitOverride);
  if (normalizedLimitOverride?.error) return error(res, normalizedLimitOverride.error, 400);

  const normalizedBlockOverride = parseNullableBooleanOverride(blockNewLeadsAfterWonOverride);
  if (normalizedBlockOverride?.error) return error(res, normalizedBlockOverride.error, 400);

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role: nextRole,
      leadReservationLimitOverride: nextRole === 'STUDENT' ? normalizedLimitOverride : null,
      blockNewLeadsAfterWonOverride: nextRole === 'STUDENT' ? normalizedBlockOverride : null,
    },
    select: baseUserSelect,
  });

  return success(res, await withStudentPolicy(user), 'تم إنشاء الحساب بنجاح', 201);
};

const update = async (req, res) => {
  const {
    name,
    email,
    role,
    active,
    password,
    leadReservationLimitOverride,
    blockNewLeadsAfterWonOverride,
  } = req.body;

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return error(res, 'المستخدم غير موجود', 404);

  if (existing.role === 'ADMIN' && role === 'STUDENT') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (adminCount <= 1) return error(res, 'لا يمكن تغيير دور آخر مدير نشط في النظام', 400);
  }

  const nextRole = role || existing.role;
  const normalizedLimitOverride = parseNullableLimitOverride(leadReservationLimitOverride);
  if (normalizedLimitOverride?.error) return error(res, normalizedLimitOverride.error, 400);

  const normalizedBlockOverride = parseNullableBooleanOverride(blockNewLeadsAfterWonOverride);
  if (normalizedBlockOverride?.error) return error(res, normalizedBlockOverride.error, 400);

  const data = {
    name,
    email,
    role,
    active,
    leadReservationLimitOverride: nextRole === 'STUDENT' ? normalizedLimitOverride : null,
    blockNewLeadsAfterWonOverride: nextRole === 'STUDENT' ? normalizedBlockOverride : null,
  };

  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: baseUserSelect,
  });

  return success(res, await withStudentPolicy(user), 'تم تحديث بيانات المستخدم');
};

const toggleActive = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return error(res, 'المستخدم غير موجود', 404);

  if (user.role === 'ADMIN' && user.active) {
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (activeAdmins <= 1) return error(res, 'لا يمكن تعطيل آخر مدير نشط في النظام', 400);
  }

  const isActivating = !user.active;
  const data = { active: isActivating };

  if (isActivating && user.role === 'STUDENT') {
    const defaultUserPass = (await getSetting('DEFAULT_STUDENT_PASSWORD')) || 'Mudrek@2024';
    data.password = await bcrypt.hash(defaultUserPass, 10);
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, role: true, active: true },
  });

  return success(res, updated, updated.active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
};

const deleteUser = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return error(res, 'المستخدم غير موجود', 404);

  if (user.id === req.user.id) return error(res, 'لا يمكنك حذف حسابك الخاص', 400);

  if (user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) return error(res, 'لا يمكن حذف آخر مدير في النظام', 400);
  }

  await prisma.user.delete({ where: { id: req.params.id } });
  return success(res, null, 'تم حذف الحساب');
};

const bulkToggleActive = async (req, res) => {
  const { userIds, active } = req.body;
  if (!Array.isArray(userIds) || typeof active !== 'boolean') {
    return error(res, 'بيانات غير صالحة', 400);
  }

  if (userIds.includes(req.user.id) && !active) {
    return error(res, 'لا يمكنك تعطيل حسابك الخاص', 400);
  }

  if (active) {
    const defaultUserPass = (await getSetting('DEFAULT_STUDENT_PASSWORD')) || 'Mudrek@2024';
    const hashedPass = await bcrypt.hash(defaultUserPass, 10);

    await prisma.user.updateMany({
      where: { id: { in: userIds }, role: 'STUDENT' },
      data: { active: true, password: hashedPass },
    });

    await prisma.user.updateMany({
      where: { id: { in: userIds }, role: 'ADMIN' },
      data: { active: true },
    });
  } else {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { active: false },
    });
  }

  return success(res, null, `تم ${active ? 'تفعيل' : 'تعطيل'} الحسابات المحددة بنجاح`);
};

const bulkDelete = async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds)) {
    return error(res, 'بيانات غير صالحة', 400);
  }

  if (userIds.includes(req.user.id)) {
    return error(res, 'لا يمكنك حذف حسابك الخاص ضمن العملية الجماعية', 400);
  }

  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  return success(res, null, 'تم حذف الحسابات المحددة بنجاح');
};

module.exports = { getAll, getOne, create, update, toggleActive, deleteUser, bulkToggleActive, bulkDelete };
