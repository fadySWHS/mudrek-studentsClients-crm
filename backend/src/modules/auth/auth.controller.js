const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { success, error } = require('../../utils/response');
const config = require('../../config');
const logger = require('../../utils/logger'); // we probably need logger to log the error

const prisma = new PrismaClient();

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return error(res, 'بيانات الدخول غير صحيحة', 401);
    if (!user.active) return error(res, 'تم تعطيل حسابك. تواصل مع المدير.', 403);

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return error(res, 'بيانات الدخول غير صحيحة', 401);

    if (!config.jwtSecret) throw new Error('JWT Secret is missing from environment variables');

    const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn || '7d',
    });

    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, 'تم تسجيل الدخول بنجاح');
  } catch (err) {
    if (logger) logger.error('Login error', { error: err.message, stack: err.stack });
    return error(res, 'خطأ داخلي في الخادم المحاولة مرة أخرى لاحقاً', 500);
  }
};

const me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
    return success(res, user);
  } catch (err) {
    if (logger) logger.error('Me error', { error: err.message, stack: err.stack });
    return error(res, 'خطأ داخلي في الخادم', 500);
  }
};

module.exports = { login, me };
