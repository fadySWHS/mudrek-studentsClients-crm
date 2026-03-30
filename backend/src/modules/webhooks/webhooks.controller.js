const { PrismaClient } = require('@prisma/client');
const { success, error } = require('../../utils/response');
const { getSetting } = require('../../utils/getSetting');

const prisma = new PrismaClient();

const receiveMakeLead = async (req, res) => {
  try {
    const providedToken = req.headers['authorization'] || req.query.token;
    const expectedToken = await getSetting('API_WEBHOOK_SECRET');

    // 1. Authenticate Request
    if (!expectedToken) {
      return error(res, 'لم يتم إعداد رمز Webhook في إعدادات النظام. يرجى تهيئته أولاً.', 503);
    }
    
    // Clean bearer format if used
    const cleanToken = providedToken?.replace('Bearer ', '').trim();
    if (!cleanToken || cleanToken !== expectedToken) {
      return error(res, 'غير مصرح بالوصول: الرمز السري للويب هوك غير صالح', 401);
    }

    // 2. Extract Data from Make.com
    const { name, phone, service, source, budget, notes } = req.body;

    if (!name || !phone) {
      return error(res, 'الاسم ورقم الهاتف مطلوبان كحد أدنى', 400);
    }

    // 3. Find System Admin (for automated logging attribution)
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', active: true },
      orderBy: { createdAt: 'asc' }
    });
    
    // Fallback if no admin exists (unlikely)
    const actorId = admin ? admin.id : null;

    // 4. Create the Lead
    const newLead = await prisma.lead.create({
      data: {
        name,
        phone,
        service: service || '—',
        source: source || 'Make.com Webhook',
        budget: budget || null,
        notes: notes || null,
        status: 'AVAILABLE',
      },
    });

    // 5. Append History Action
    if (actorId) {
      await prisma.leadHistory.create({
        data: {
          leadId: newLead.id,
          actorId,
          actionType: 'CREATED_VIA_WEBHOOK',
          toValue: 'AVAILABLE',
        },
      });
    }

    return success(res, newLead, 'تم استلام العميل وتسجيله بنجاح', 201);
  } catch (err) {
    console.error('Webhook Error:', err);
    return error(res, 'حدث خطأ أثناء معالجة البيانات', 500);
  }
};

module.exports = { receiveMakeLead };
