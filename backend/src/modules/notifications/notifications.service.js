const { sendWhatsAppMessage } = require('../integrations/twochat/twochat.service');
const { getSetting } = require('../../utils/getSetting');
const logger = require('../../utils/logger');

const parseBooleanSetting = (value, defaultValue) => {
  if (value === undefined || value === null) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const isWhatsAppNotificationEnabled = async (eventKey, defaultEnabled = true) => {
  const [globalRaw, eventRaw] = await Promise.all([
    getSetting('WHATSAPP_NOTIFICATIONS_ENABLED'),
    eventKey ? getSetting(eventKey) : Promise.resolve(undefined),
  ]);

  const globalEnabled = parseBooleanSetting(globalRaw, true);
  const eventEnabled = eventKey ? parseBooleanSetting(eventRaw, defaultEnabled) : true;

  return globalEnabled && eventEnabled;
};

const safeName = (user) => user?.name || 'النظام';

const notifyLeadClaimed = async (lead, student) => {
  try {
    const enabled = await isWhatsAppNotificationEnabled('WHATSAPP_NOTIFY_LEAD_CLAIMED', true);
    if (!enabled) return;

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

const notifyLeadReleaseRequested = async (lead, student, studentNote) => {
  try {
    const enabled = await isWhatsAppNotificationEnabled('WHATSAPP_NOTIFY_LEAD_RELEASE_REQUESTED', true);
    if (!enabled) return;

    const message =
      `📨 *طلب إعادة عميل إلى المتاح*\n\n` +
      `👤 العميل: ${lead.name}\n` +
      `📞 الهاتف: ${lead.phone}\n` +
      `👨‍🎓 الطالب: ${student.name}\n` +
      `📌 الحالة الحالية: ${lead.status}\n` +
      `📝 ملاحظة الطالب: ${studentNote || 'لا توجد ملاحظة'}\n` +
      `⏰ الوقت: ${new Date().toLocaleString('ar-EG')}`;

    await sendWhatsAppMessage(message);
    logger.info('WhatsApp notification sent for lead release request', { leadId: lead.id, studentId: student.id });
  } catch (err) {
    logger.error('Failed to send lead release request notification', { error: err.message });
  }
};

const notifyOverdueReminder = async (reminder, lead, student) => {
  try {
    const enabled = await isWhatsAppNotificationEnabled('WHATSAPP_NOTIFY_REMINDER_OVERDUE', false);
    if (!enabled) return;

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

const notifyLeadCreated = async (lead, actor, createdVia = '') => {
  try {
    const enabled = await isWhatsAppNotificationEnabled('WHATSAPP_NOTIFY_LEAD_CREATED', true);
    if (!enabled) return;

    const viaLabel = createdVia ? ` (${createdVia})` : '';
    const sourceLabel = lead.source || '—';

    const message =
      `🆕 *تم إضافة عميل جديد${viaLabel}*\n\n` +
      `👤 العميل: ${lead.name}\n` +
      `📞 الهاتف: ${lead.phone}\n` +
      `🛠️ الخدمة: ${lead.service || 'غير محدد'}\n` +
      `🏷️ المصدر: ${sourceLabel}\n` +
      `👮 بواسطة: ${safeName(actor)}\n` +
      `⏰ الوقت: ${new Date().toLocaleString('ar-EG')}`;

    await sendWhatsAppMessage(message);
  } catch (err) {
    logger.error('Failed to send lead created notification', { error: err.message });
  }
};

const notifyLeadClosed = async (lead, actor) => {
  try {
    const isWon = lead.status === 'CLOSED_WON';
    const key = isWon ? 'WHATSAPP_NOTIFY_LEAD_CLOSED_WON' : 'WHATSAPP_NOTIFY_LEAD_CLOSED_LOST';
    const enabled = await isWhatsAppNotificationEnabled(key, isWon);
    if (!enabled) return;

    const title = isWon ? '✅ *تم إغلاق العميل - ناجح*' : '❌ *تم إغلاق العميل - خاسر*';
    const lostReasonLine = !isWon && lead.lostReason ? `🧾 السبب: ${lead.lostReason}\n` : '';

    const message =
      `${title}\n\n` +
      `👤 العميل: ${lead.name}\n` +
      `📞 الهاتف: ${lead.phone}\n` +
      lostReasonLine +
      `👮 بواسطة: ${safeName(actor)}\n` +
      `⏰ الوقت: ${new Date().toLocaleString('ar-EG')}`;

    await sendWhatsAppMessage(message);
  } catch (err) {
    logger.error('Failed to send lead closed notification', { error: err.message });
  }
};

module.exports = {
  notifyLeadClaimed,
  notifyLeadReleaseRequested,
  notifyOverdueReminder,
  notifyLeadCreated,
  notifyLeadClosed,
};
