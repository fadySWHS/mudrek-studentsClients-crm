'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { leadsService, commentsService, remindersService, Lead, LeadComment, LeadHistory, Reminder } from '@/services/leads';
import { useAuth } from '@/context/AuthContext';
import LeadStatusBadge from '@/components/shared/LeadStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { leadStatusLabels } from '@/utils/leadStatus';
import toast from 'react-hot-toast';
import { ArrowRight, MessageSquare, Clock, History, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import LeadFormModal from '@/components/leads/LeadFormModal';

type LeadDetail = Lead & { comments: LeadComment[]; history: LeadHistory[]; reminders: Reminder[] };

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [addingReminder, setAddingReminder] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [lostReason, setLostReason] = useState('');

  const fetchLead = async () => {
    try {
      const data = await leadsService.getOne(id);
      setLead(data);
      setNewStatus(data.status);
    } catch {
      toast.error('فشل تحميل بيانات العميل');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLead(); }, [id]);

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setAddingComment(true);
    try {
      await commentsService.add(id, comment.trim());
      setComment('');
      toast.success('تم إضافة التعليق');
      fetchLead();
    } catch (e: any) { toast.error(e.message); }
    finally { setAddingComment(false); }
  };

  const handleAddReminder = async () => {
    if (!reminderDate) return;
    setAddingReminder(true);
    try {
      await remindersService.create(id, { dueAt: reminderDate, note: reminderNote || undefined });
      setReminderDate(''); setReminderNote('');
      toast.success('تم إضافة التذكير');
      fetchLead();
    } catch (e: any) { toast.error(e.message); }
    finally { setAddingReminder(false); }
  };

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === lead?.status) return;
    setChangingStatus(true);
    try {
      await leadsService.update(id, { status: newStatus as any, lostReason: newStatus === 'CLOSED_LOST' ? lostReason : undefined });
      toast.success('تم تحديث الحالة');
      fetchLead();
    } catch (e: any) { toast.error(e.message); }
    finally { setChangingStatus(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!lead) return null;

  const canEdit = isAdmin || lead.assignedToId === user?.id;

  return (
    <div>
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4 group">
        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        رجوع
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-3">
            {lead.name}
            <LeadStatusBadge status={lead.status} />
          </h1>
          <p className="text-sm text-gray-500" dir="ltr">{lead.phone}</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowEdit(true)} className="btn-secondary flex items-center gap-2">
            <Edit className="h-4 w-4" />
            تعديل
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: details + status + reminders */}
        <div className="lg:col-span-1 space-y-4">
          {/* Details */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-3">بيانات العميل</h3>
            <dl className="space-y-2 text-sm">
              {lead.service && <Row label="الخدمة" value={lead.service} />}
              {lead.source && <Row label="المصدر" value={lead.source} />}
              {lead.budget && <Row label="الميزانية" value={lead.budget} />}
              {lead.assignedTo && <Row label="المسؤول" value={lead.assignedTo.name} />}
              {lead.lostReason && <Row label="سبب الخسارة" value={lead.lostReason} highlight="error" />}
              {lead.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <dt className="text-gray-500 mb-1">ملاحظات</dt>
                  <dd className="text-gray-700 leading-relaxed">{lead.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Status change */}
          {canEdit && (
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-3">تغيير الحالة</h3>
              <select className="input-field mb-2" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {Object.entries(leadStatusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {newStatus === 'CLOSED_LOST' && (
                <input className="input-field mb-2" placeholder="سبب الخسارة" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
              )}
              <button onClick={handleStatusChange} disabled={changingStatus || newStatus === lead.status} className="btn-primary w-full">
                {changingStatus ? 'جارٍ التحديث...' : 'تحديث الحالة'}
              </button>
            </div>
          )}

          {/* Reminders */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              التذكيرات
            </h3>
            {canEdit && (
              <div className="space-y-2 mb-4">
                <input type="datetime-local" className="input-field text-xs" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
                <input className="input-field" placeholder="ملاحظة (اختياري)" value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} />
                <button onClick={handleAddReminder} disabled={addingReminder || !reminderDate} className="btn-primary w-full">
                  إضافة تذكير
                </button>
              </div>
            )}
            {lead.reminders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">لا توجد تذكيرات</p>
            ) : (
              <div className="space-y-2">
                {lead.reminders.map((r) => (
                  <div key={r.id} className="flex items-start justify-between text-xs p-2 rounded-lg bg-surface">
                    <div>
                      <p className="font-medium text-gray-700">{format(new Date(r.dueAt), 'dd MMM yyyy — hh:mm a', { locale: ar })}</p>
                      {r.note && <p className="text-gray-400 mt-0.5">{r.note}</p>}
                    </div>
                    <span className={`badge text-xs ${r.status === 'DONE' ? 'bg-green-100 text-green-700' : r.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.status === 'DONE' ? 'منجز' : r.status === 'OVERDUE' ? 'متأخر' : 'معلق'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right col: timeline + comments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Comments */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              التعليقات ({lead.comments.length})
            </h3>

            {canEdit && (
              <div className="flex gap-2 mb-4">
                <textarea
                  className="input-field flex-1 h-20 resize-none"
                  placeholder="أضف تعليقاً..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button onClick={handleAddComment} disabled={addingComment || !comment.trim()} className="btn-primary px-4 self-end">
                  إرسال
                </button>
              </div>
            )}

            {lead.comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">لا توجد تعليقات بعد</p>
            ) : (
              <div className="space-y-3">
                {lead.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 bg-primary-light rounded-full flex-shrink-0 flex items-center justify-center">
                      <span className="text-primary text-xs font-bold">{c.user.name[0]}</span>
                    </div>
                    <div className="flex-1 bg-surface rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-900">{c.user.name}</span>
                        <span className="text-xs text-gray-400">{format(new Date(c.createdAt), 'dd MMM yyyy', { locale: ar })}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{c.commentText}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="card">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-secondary" />
              سجل النشاط
            </h3>
            {lead.history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">لا يوجد سجل</p>
            ) : (
              <div className="relative">
                <div className="absolute right-3 top-0 bottom-0 w-0.5 bg-gray-100" />
                <div className="space-y-4 pr-8">
                  {lead.history.map((h) => (
                    <div key={h.id} className="relative">
                      <div className="absolute -right-5 w-2.5 h-2.5 rounded-full bg-primary-light border-2 border-primary top-1" />
                      <p className="text-xs font-semibold text-gray-700">
                        {historyLabel(h.actionType, h.fromValue, h.toValue)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.actor.name} · {format(new Date(h.createdAt), 'dd MMM yyyy — hh:mm a', { locale: ar })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <LeadFormModal
          lead={lead}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); fetchLead(); }}
        />
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-medium ${highlight === 'error' ? 'text-error' : 'text-gray-900'}`}>{value}</dd>
    </div>
  );
}

function historyLabel(action: string, from?: string, to?: string): string {
  const map: Record<string, string> = {
    CREATED: 'تم إنشاء العميل',
    CLAIMED: 'تم حجز العميل',
    STATUS_CHANGE: `تغيير الحالة من ${from || ''} إلى ${to || ''}`,
    ASSIGNED: 'تم التعيين',
  };
  return map[action] || action;
}
