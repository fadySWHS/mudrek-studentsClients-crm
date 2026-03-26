const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { success, error } = require('../../utils/response');

const prisma = new PrismaClient();

const getAll = async (req, res) => {
  const users = await prisma.user.findMany({
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
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return error(res, 'البريد الإلكتروني مستخدم بالفعل', 409);

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: role || 'STUDENT' },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return success(res, user, 'تم إنشاء المستخدم بنجاح', 201);
};

const update = async (req, res) => {
  const { name, email, role, active } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { name, email, role, active },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return success(res, user, 'تم تحديث بيانات المستخدم');
};

const toggleActive = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return error(res, 'المستخدم غير موجود', 404);

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { active: !user.active },
    select: { id: true, name: true, active: true },
  });
  return success(res, updated, updated.active ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب');
};

module.exports = { getAll, getOne, create, update, toggleActive };
