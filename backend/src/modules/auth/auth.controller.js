const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { success, error } = require('../../utils/response');
const config = require('../../config');

const prisma = new PrismaClient();

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password) return error(res, 'بيانات الدخول غير صحيحة', 401);
  if (!user.active) return error(res, 'تم تعطيل حسابك. تواصل مع المدير.', 403);

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return error(res, 'بيانات الدخول غير صحيحة', 401);

  const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  return success(res, {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  }, 'تم تسجيل الدخول بنجاح');
};

const me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  return success(res, user);
};

module.exports = { login, me };
