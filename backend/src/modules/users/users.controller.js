const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { success, error } = require('../../utils/response');

const prisma = new PrismaClient();

const getAll = async (req, res) => {
  const { role } = req.query;
  const where = role ? { role } : {};

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, active: true, sourceStudentId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return success(res, users);
};

const getOne = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true, active: true, sourceStudentId: true, createdAt: true },
  });
  if (!user) return error(res, 'المستخدم غير موجود', 404);
  return success(res, user);
};

const create = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return error(res, 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة', 400);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return error(res, 'البريد الإلكتروني مستخدم بالفعل', 409);

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: role || 'STUDENT' },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return success(res, user, 'تم إنشاء الحساب بنجاح', 201);
};

const update = async (req, res) => {
  const { name, email, role, active, password } = req.body;
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return error(res, 'المستخدم غير موجود', 404);

  // Prevent removing the last admin
  if (existing.role === 'ADMIN' && role === 'STUDENT') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (adminCount <= 1) return error(res, 'لا يمكن تغيير دور آخر مدير نشط في النظام', 400);
  }

  const data = { name, email, role, active };
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return success(res, user, 'تم تحديث بيانات المستخدم');
};

const toggleActive = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return error(res, 'المستخدم غير موجود', 404);

  // Prevent disabling the last active admin
  if (user.role === 'ADMIN' && user.active) {
    const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
    if (activeAdmins <= 1) return error(res, 'لا يمكن تعطيل آخر مدير نشط في النظام', 400);
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { active: !user.active },
    select: { id: true, name: true, role: true, active: true },
  });
  return success(res, updated, updated.active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
};

const deleteUser = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return error(res, 'المستخدم غير موجود', 404);

  // Prevent self-deletion
  if (user.id === req.user.id) return error(res, 'لا يمكنك حذف حسابك الخاص', 400);

  // Prevent deleting last admin
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

  const hasSelf = userIds.includes(req.user.id);
  if (hasSelf && !active) {
    return error(res, 'لا يمكنك تعطيل حسابك الخاص', 400);
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { active },
  });

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
