const { sendWhatsAppMessage } = require('../integrations/twochat/twochat.service');
const logger = require('../../utils/logger');

const notifyLeadClaimed = async (lead, student) => {
  try {
    const message =
      `🎯 *عميل جديد تم أخذه*\n\n` +
      `👤 العميل: ${lead.name}\n` +
      `📞 الهاتف: ${lead.phone}\n` +
      `🛠️ الخدمة: ${lead.service || 'غير محدد'}\n` +
      `👨‍🎓 الطالب: ${student.name}\n` +
      `⏰ الوقت: ${new Date().toLocaleString('ar-EG')}`;

    await sendWhatsAppMessage(message);
    logger.info('WhatsApp notification sent for lead claim', { leadId: lead.id });
  } catch (err) {
    logger.error('Failed to send WhatsApp notification', { error: err.message });
  }
};

const notifyOverdueReminder = async (reminder, lead, student) => {
  try {
    const message =
      `⚠️ *تذكير متأخر*\n\n` +
      `👤 العميل: ${lead.name}\n` +
      `👨‍🎓 الطالب: ${student.name}\n` +
      `📝 الملاحظة: ${reminder.note || 'لا يوجد'}\n` +
      `📅 كان مستحق: ${new Date(reminder.dueAt).toLocaleString('ar-EG')}`;

    await sendWhatsAppMessage(message);
  } catch (err) {
    logger.error('Failed to send overdue reminder notification', { error: err.message });
  }
};

module.exports = { notifyLeadClaimed, notifyOverdueReminder };
