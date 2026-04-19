'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  leadsService,
  commentsService,
  remindersService,
  Lead,
  LeadCallRecord,
  LeadComment,
  LeadHistory,
  LeadReleaseRequest,
  Reminder,
} from '@/services/leads';
import { useAuth } from '@/context/AuthContext';
import { useAi } from '@/context/AiContext';
import LeadStatusBadge from '@/components/shared/LeadStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { leadStatusLabels } from '@/utils/leadStatus';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Edit,
  FileAudio,
  History,
  LockKeyhole,
  MessageSquare,
  PhoneCall,
  Sparkles,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import LeadFormModal from '@/components/leads/LeadFormModal';

type LeadDetail = Lead & {
  comments: LeadComment[];
  history: LeadHistory[];
  reminders: Reminder[];
  releaseRequests: LeadReleaseRequest[];
  callRecords: LeadCallRecord[];
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { openWithPrompt } = useAi();

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
  const [releaseNote, setReleaseNote] = useState('');
  const [requestingRelease, setRequestingRelease] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [uploadingCallRecord, setUploadingCallRecord] = useState(false);

  const fetchLead = async () => {
    try {
      const data = await leadsService.getOne(id);
      setLead(data);
      setNewStatus(data.status);
      setLostReason(data.lostReason || '');
    } catch {
      toast.error('فشل تحميل بيانات العميل');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLead();
  }, [id]);

  const canEdit = isAdmin || lead?.assignedToId === user?.id;
  const statusOptions = useMemo(
    () => Object.entries(leadStatusLabels).filter(([value]) => isAdmin || value !== 'AVAILABLE'),
    [isAdmin]
  );
  const pendingReleaseRequests = useMemo(
    () => lead?.releaseRequests.filter((request) => request.status === 'PENDING') || [],
    [lead]
  );
  const studentPendingReleaseRequest = useMemo(
    () => pendingReleaseRequests.find((request) => request.studentId === user?.id) || null,
    [pendingReleaseRequests, user?.id]
  );

  const aiLeadContext = lead
    ? {
        id: lead.id,
        name: lead.name,
        service: lead.service,
        budget: lead.budget,
        notes: lead.notes,
      }
    : undefined;

  const handleAddComment = async () => {
    if (!comment.trim()) return;

    setAddingComment(true);
    try {
      await commentsService.add(id, comment.trim());
      setComment('');
      toast.success('تم إضافة التعليق');
      await fetchLead();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingComment(false);
    }
  };

  const handleAddReminder = async () => {
    if (!reminderDate) return;

    setAddingReminder(true);
    try {
      await remindersService.create(id, { dueAt: reminderDate, note: reminderNote || undefined });
      setReminderDate('');
      setReminderNote('');
      toast.success('تم إضافة التذكير');
      await fetchLead();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingReminder(false);
    }
  };

  const handleStatusChange = async () => {
    if (!lead || !newStatus || newStatus === lead.status) return;

    setChangingStatus(true);
    try {
      await leadsService.update(id, {
        status: newStatus as Lead['status'],
        lostReason: newStatus === 'CLOSED_LOST' ? lostReason : undefined,
      });
      toast.success('تم تحديث الحالة');
      await fetchLead();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChangingStatus(false);
    }
  };

  const handleRequestRelease = async () => {
    if (!lead || !canEdit || isAdmin || studentPendingReleaseRequest) return;

    setRequestingRelease(true);
    try {
      await leadsService.requestRelease(id, releaseNote || undefined);
      setReleaseNote('');
      toast.success('تم إرسال طلب المراجعة للإدارة');
      await fetchLead();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRequestingRelease(false);
    }
  };

  const handleReviewReleaseRequest = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    setReviewingRequestId(requestId);
    try {
      await leadsService.reviewReleaseRequest(id, requestId, {
        decision,
        adminNote: adminNotes[requestId] || undefined,
      });
      toast.success(decision === 'APPROVED' ? 'تمت الموافقة على الطلب' : 'تم رفض الطلب');
      await fetchLead();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReviewingRequestId(null);
    }
  };

  const handleAddCallRecord = async () => {
    if (!selectedAudio) return;

    setUploadingCallRecord(true);
    try {
      await leadsService.addCallRecord(id, selectedAudio);
      setSelectedAudio(null);
      toast.success('تمت إضافة تسجيل المكالمة وتحليلها');
      await fetchLead();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingCallRecord(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  }

  if (!lead) return null;

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="group mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        رجوع
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-3">
            {lead.name}
            <LeadStatusBadge status={lead.status} />
          </h1>
          <p className="text-sm text-gray-500" dir="ltr">{lead.phone}</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openWithPrompt('اقترح رسالة أو عرضا جذابا لهذا العميل بناء على بياناته، وكيف يمكنني الإغلاق معه؟', aiLeadContext)}
              className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Sparkles className="h-4 w-4" />
              مساعد AI
            </button>
            <button onClick={() => setShowEdit(true)} className="btn-secondary flex items-center gap-2">
              <Edit className="h-4 w-4" />
              تعديل
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="card">
            <h3 className="mb-3 font-bold text-gray-900">بيانات العميل</h3>
            <dl className="space-y-2 text-sm">
              {lead.service && <Row label="الخدمة" value={lead.service} />}
              {lead.source && <Row label="المصدر" value={lead.source} />}
              {lead.budget && <Row label="الميزانية" value={lead.budget} />}
              {lead.assignedTo && <Row label="المسؤول" value={lead.assignedTo.name} />}
              {lead.lostReason && <Row label="سبب الخسارة" value={lead.lostReason} highlight="error" />}
              {lead.notes && (
                <div className="border-t border-gray-100 pt-2">
                  <dt className="mb-1 text-gray-500">ملاحظات</dt>
                  <dd className="leading-relaxed text-gray-700">{lead.notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {(lead.aiProfileSummary || lead.aiProfileInsights) && (
            <div className="card border border-primary/10 bg-primary/[0.03]">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
                <Sparkles className="h-4 w-4 text-primary" />
                ملف العميل المستخرج من المكالمات
              </h3>

              {lead.aiProfileSummary && (
                <p className="text-sm leading-7 text-gray-700">{lead.aiProfileSummary}</p>
              )}

              {lead.aiProfileInsights?.recommendedNextStep && (
                <div className="mt-3 rounded-xl bg-white p-3 text-sm text-gray-700 shadow-sm">
                  <p className="mb-1 text-xs font-semibold text-gray-500">الخطوة المقترحة التالية</p>
                  <p>{lead.aiProfileInsights.recommendedNextStep}</p>
                </div>
              )}

              <div className="mt-3 space-y-3 text-sm">
                {lead.aiProfileInsights?.discoveredFacts?.length ? (
                  <InsightList title="حقائق مكتشفة" items={lead.aiProfileInsights.discoveredFacts} />
                ) : null}
                {lead.aiProfileInsights?.needs?.length ? (
                  <InsightList title="احتياجات العميل" items={lead.aiProfileInsights.needs} />
                ) : null}
                {lead.aiProfileInsights?.objections?.length ? (
                  <InsightList title="اعتراضات" items={lead.aiProfileInsights.objections} />
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                {lead.aiProfileInsights?.serviceHint && <Row label="تلميح الخدمة" value={lead.aiProfileInsights.serviceHint} />}
                {lead.aiProfileInsights?.budgetSignals && <Row label="مؤشرات الميزانية" value={lead.aiProfileInsights.budgetSignals} />}
                {lead.aiProfileInsights?.decisionTimeline && <Row label="التوقيت المتوقع" value={lead.aiProfileInsights.decisionTimeline} />}
                {lead.aiProfileInsights?.decisionMaker && <Row label="صاحب القرار" value={lead.aiProfileInsights.decisionMaker} />}
                {lead.aiProfileInsights?.sentiment && <Row label="انطباع العميل" value={lead.aiProfileInsights.sentiment} />}
                {lead.aiProfileInsights?.suggestedStatus && (
                  <Row label="الحالة المقترحة" value={leadStatusLabels[lead.aiProfileInsights.suggestedStatus]} />
                )}
              </div>
            </div>
          )}

          {canEdit && (
            <div className="card">
              <h3 className="mb-3 font-bold text-gray-900">تغيير الحالة</h3>
              <select className="input-field mb-2" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {statusOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {!isAdmin && (
                <p className="mb-2 text-xs text-gray-500">
                  إعادة العميل إلى المتاح لا تتم من هنا. يجب إرسال طلب مراجعة للإدارة أولاً.
                </p>
              )}
              {newStatus === 'CLOSED_LOST' && (
                <input
                  className="input-field mb-2"
                  placeholder="سبب الخسارة"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                />
              )}
              <button
                onClick={handleStatusChange}
                disabled={changingStatus || newStatus === lead.status}
                className="btn-primary w-full"
              >
                {changingStatus ? 'جار تحديث الحالة...' : 'تحديث الحالة'}
              </button>
            </div>
          )}

          {!isAdmin && canEdit && !lead.status.startsWith('CLOSED_') && (
            <div className="card">
              <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
                <LockKeyhole className="h-4 w-4 text-amber-600" />
                طلب إعادة العميل إلى المتاح
              </h3>

              {studentPendingReleaseRequest ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">يوجد طلب قيد المراجعة من الإدارة.</p>
                  <p className="mt-1 text-xs text-amber-700">
                    أُرسل في {formatDate(studentPendingReleaseRequest.createdAt)}
                  </p>
                  {studentPendingReleaseRequest.studentNote && (
                    <p className="mt-2 leading-6 text-amber-800">{studentPendingReleaseRequest.studentNote}</p>
                  )}
                </div>
              ) : (
                <>
                  <p className="mb-2 text-sm leading-6 text-gray-600">
                    سيبقى العميل محسوباً عليك حتى يراجع المدير التعليقات والمكالمات وسجل المتابعة ثم يوافق على إعادته.
                  </p>
                  <textarea
                    className="input-field h-24 resize-none"
                    placeholder="اكتب ماذا تم مع العميل ولماذا تريد إعادته إلى المتاح"
                    value={releaseNote}
                    onChange={(e) => setReleaseNote(e.target.value)}
                  />
                  <button
                    onClick={handleRequestRelease}
                    disabled={requestingRelease}
                    className="btn-primary mt-3 w-full"
                  >
                    {requestingRelease ? 'جار إرسال الطلب...' : 'إرسال طلب مراجعة'}
                  </button>
                </>
              )}
            </div>
          )}

          {isAdmin && lead.releaseRequests.length > 0 && (
            <div className="card">
              <h3 className="mb-3 font-bold text-gray-900">طلبات إعادة العميل</h3>
              <div className="space-y-3">
                {lead.releaseRequests.map((request) => {
                  const noteValue = adminNotes[request.id] ?? request.adminNote ?? '';
                  const isPending = request.status === 'PENDING';

                  return (
                    <div key={request.id} className="rounded-xl border border-gray-100 bg-surface p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{request.student.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(request.createdAt)}</p>
                        </div>
                        <ReleaseStatusBadge status={request.status} />
                      </div>

                      {request.studentNote && (
                        <p className="mt-3 text-sm leading-6 text-gray-700">{request.studentNote}</p>
                      )}

                      {isPending ? (
                        <>
                          <textarea
                            className="input-field mt-3 h-20 resize-none"
                            placeholder="ملاحظة المدير عند القرار"
                            value={noteValue}
                            onChange={(e) =>
                              setAdminNotes((prev) => ({
                                ...prev,
                                [request.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleReviewReleaseRequest(request.id, 'APPROVED')}
                              disabled={reviewingRequestId === request.id}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              موافقة
                            </button>
                            <button
                              onClick={() => handleReviewReleaseRequest(request.id, 'REJECTED')}
                              disabled={reviewingRequestId === request.id}
                              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                            >
                              <XCircle className="h-4 w-4" />
                              رفض
                            </button>
                          </div>
                        </>
                      ) : request.adminNote ? (
                        <div className="mt-3 rounded-xl bg-white p-3 text-sm text-gray-700 shadow-sm">
                          <p className="mb-1 text-xs font-semibold text-gray-500">
                            {request.reviewedBy ? `ملاحظة ${request.reviewedBy.name}` : 'ملاحظة الإدارة'}
                          </p>
                          <p>{request.adminNote}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
              <Clock className="h-4 w-4 text-amber-500" />
              التذكيرات
            </h3>
            {canEdit && (
              <div className="mb-4 space-y-2">
                <input
                  type="datetime-local"
                  className="input-field text-xs"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                />
                <input
                  className="input-field"
                  placeholder="ملاحظة (اختياري)"
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                />
                <button onClick={handleAddReminder} disabled={addingReminder || !reminderDate} className="btn-primary w-full">
                  إضافة تذكير
                </button>
              </div>
            )}

            {lead.reminders.length === 0 ? (
              <p className="py-2 text-center text-sm text-gray-400">لا توجد تذكيرات</p>
            ) : (
              <div className="space-y-2">
                {lead.reminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-start justify-between rounded-lg bg-surface p-2 text-xs">
                    <div>
                      <p className="font-medium text-gray-700">{formatDate(reminder.dueAt)}</p>
                      {reminder.note && <p className="mt-0.5 text-gray-400">{reminder.note}</p>}
                    </div>
                    <span className={`badge text-xs ${reminderStatusClass(reminder.status)}`}>
                      {reminderStatusLabel(reminder.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <PhoneCall className="h-4 w-4 text-primary" />
              تسجيلات المكالمات
            </h3>

            {canEdit && (
              <div className="mb-4 rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-4">
                {selectedAudio ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <FileAudio className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{selectedAudio.name}</p>
                        <p className="text-xs text-gray-500">
                          {(selectedAudio.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAudio(null)}
                        disabled={uploadingCallRecord}
                        className="btn-secondary"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCallRecord}
                        disabled={uploadingCallRecord}
                        className="btn-primary"
                      >
                        {uploadingCallRecord ? 'جار تحليل المكالمة...' : 'رفع وتحليل المكالمة'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-3 py-6 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                      <UploadCloud className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">أضف تسجيل مكالمة لهذا العميل</p>
                      <p className="mt-1 text-xs text-gray-500">
                        سيتم تفريغ التسجيل وتحويله إلى ملخص وحقائق قابلة للاستخدام داخل الملف.
                      </p>
                    </div>
                    <span className="btn-primary inline-flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      اختيار ملف
                    </span>
                    <input
                      type="file"
                      accept="audio/mp3,audio/wav,audio/m4a,audio/x-m4a,audio/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) setSelectedAudio(file);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {lead.callRecords.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">لا توجد تسجيلات مكالمات مضافة بعد.</p>
            ) : (
              <div className="space-y-3">
                {lead.callRecords.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-gray-100 bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {record.fileName || 'تسجيل مكالمة'}
                        </p>
                        <p className="text-xs text-gray-500">
                          أضيف بواسطة {record.uploadedBy.name} في {formatDate(record.createdAt)}
                        </p>
                      </div>
                      {record.suggestedStatus && (
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                          {leadStatusLabels[record.suggestedStatus]}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-7 text-gray-700">{record.summary}</p>

                    {record.nextStep && (
                      <div className="mt-3 rounded-xl bg-white p-3 text-sm text-gray-700 shadow-sm">
                        <p className="mb-1 text-xs font-semibold text-gray-500">الخطوة التالية</p>
                        <p>{record.nextStep}</p>
                      </div>
                    )}

                    <div className="mt-3 space-y-3 text-sm">
                      {record.extractedProfile?.discoveredFacts?.length ? (
                        <InsightList title="حقائق مكتشفة" items={record.extractedProfile.discoveredFacts} />
                      ) : null}
                      {record.extractedProfile?.needs?.length ? (
                        <InsightList title="احتياجات" items={record.extractedProfile.needs} />
                      ) : null}
                      {record.extractedProfile?.objections?.length ? (
                        <InsightList title="اعتراضات" items={record.extractedProfile.objections} />
                      ) : null}
                    </div>

                    <details className="mt-3 rounded-xl bg-white p-3 shadow-sm">
                      <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                        عرض التفريغ النصي
                      </summary>
                      <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-gray-600">
                        {record.transcript}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <MessageSquare className="h-4 w-4 text-primary" />
              التعليقات ({lead.comments.length})
            </h3>

            {canEdit && (
              <div className="mb-4 flex gap-2">
                <textarea
                  className="input-field h-20 flex-1 resize-none"
                  placeholder="أضف تعليقاً..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button onClick={handleAddComment} disabled={addingComment || !comment.trim()} className="btn-primary self-end px-4">
                  إرسال
                </button>
              </div>
            )}

            {lead.comments.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">لا توجد تعليقات بعد</p>
            ) : (
              <div className="space-y-3">
                {lead.comments.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-light">
                      <span className="text-xs font-bold text-primary">{item.user.name[0]}</span>
                    </div>
                    <div className="flex-1 rounded-xl bg-surface p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{item.user.name}</span>
                        <span className="text-xs text-gray-400">{formatDate(item.createdAt, 'dd MMM yyyy')}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-700">{item.commentText}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900">
              <History className="h-4 w-4 text-secondary" />
              سجل النشاط
            </h3>
            {lead.history.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">لا يوجد سجل</p>
            ) : (
              <div className="relative">
                <div className="absolute bottom-0 right-3 top-0 w-0.5 bg-gray-100" />
                <div className="space-y-4 pr-8">
                  {lead.history.map((item) => (
                    <div key={item.id} className="relative">
                      <div className="absolute -right-5 top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-primary-light" />
                      <p className="text-xs font-semibold text-gray-700">
                        {historyLabel(item.actionType, item.fromValue, item.toValue)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {item.actor.name} · {formatDate(item.createdAt)}
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
          onSaved={() => {
            setShowEdit(false);
            fetchLead();
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'error' }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-left font-medium ${highlight === 'error' ? 'text-error' : 'text-gray-900'}`}>
        {value}
      </dd>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={`${title}-${item}`} className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 shadow-sm">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReleaseStatusBadge({ status }: { status: LeadReleaseRequest['status'] }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        تمت الموافقة
      </span>
    );
  }

  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        مرفوض
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
      <LockKeyhole className="h-3.5 w-3.5" />
      قيد المراجعة
    </span>
  );
}

function reminderStatusLabel(status: Reminder['status']) {
  if (status === 'DONE') return 'منجز';
  if (status === 'OVERDUE') return 'متأخر';
  return 'معلق';
}

function reminderStatusClass(status: Reminder['status']) {
  if (status === 'DONE') return 'bg-green-100 text-green-700';
  if (status === 'OVERDUE') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function formatDate(value: string, pattern = 'dd MMM yyyy · hh:mm a') {
  return format(new Date(value), pattern, { locale: ar });
}

function historyLabel(action: string, from?: string, to?: string): string {
  const formatStatus = (value?: string) =>
    value && value in leadStatusLabels
      ? leadStatusLabels[value as keyof typeof leadStatusLabels]
      : value || '';

  if (action === 'STATUS_CHANGE') {
    return `تغيير الحالة من ${formatStatus(from)} إلى ${formatStatus(to)}`;
  }

  if (action === 'ASSIGNED') {
    if (from && !to) return 'تم سحب تعيين العميل';
    if (!from && to) return 'تم تعيين العميل';
    return 'تم تحديث التعيين';
  }

  const map: Record<string, string> = {
    CREATED: 'تم إنشاء العميل',
    CLAIMED: 'تم حجز العميل',
    RELEASE_REQUESTED: 'تم إرسال طلب إعادة العميل للمراجعة',
    RELEASE_APPROVED: 'تمت الموافقة على إعادة العميل إلى المتاح',
    RELEASE_REJECTED: 'تم رفض طلب إعادة العميل',
    CALL_RECORD_ADDED: 'تمت إضافة تسجيل مكالمة جديد',
  };

  return map[action] || action;
}
