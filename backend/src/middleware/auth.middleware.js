const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { error } = require('../utils/response');
const config = require('../config');

const prisma = new PrismaClient();

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'غير مصرح - يرجى تسجيل الدخول', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) return error(res, 'المستخدم غير موجود', 401);
    if (!user.active) return error(res, 'تم تعطيل حسابك. تواصل مع المدير.', 403);

    req.user = user;
    next();
  } catch {
    return error(res, 'رمز غير صالح أو منتهي الصلاحية', 401);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return error(res, 'هذا الإجراء مخصص للمدير فقط', 403);
  }
  next();
};

module.exports = { authenticate, requireAdmin };
