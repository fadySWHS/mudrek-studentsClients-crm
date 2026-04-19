'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Bot,
  CircleAlert,
  Edit,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import AssignModal from '@/components/leads/AssignModal';
import LeadFormModal from '@/components/leads/LeadFormModal';
import PendingReleaseRequestsAlert from '@/components/leads/PendingReleaseRequestsAlert';
import Header from '@/components/layout/Header';
import EmptyState from '@/components/shared/EmptyState';
import LeadStatusBadge from '@/components/shared/LeadStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Pagination from '@/components/shared/Pagination';
import { useAuth } from '@/context/AuthContext';
import {
  Lead,
  LeadClaimPolicy,
  PendingLeadReleaseRequest,
  leadsService,
} from '@/services/leads';
import { Student, studentsService } from '@/services/students';
import { leadStatusLabels } from '@/utils/leadStatus';

const STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'كل الحالات' },
  ...Object.entries(leadStatusLabels).map(([value, label]) => ({ value, label })),
];

export default function LeadsPage() {
  const { isAdmin } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [claimPolicy, setClaimPolicy] = useState<LeadClaimPolicy | null>(null);
  const [pendingReleaseRequests, setPendingReleaseRequests] = useState<PendingLeadReleaseRequest[]>([]);
  const [pendingReleaseTotal, setPendingReleaseTotal] = useState(0);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await leadsService.getAll({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      });
      setLeads(response.leads);
      setTotal(response.total);
    } finally {
      setLoading(false);
    }
  }, [limit, page, search, statusFilter]);

  const fetchClaimPolicy = useCallback(async () => {
    if (isAdmin) return;

    try {
      const policy = await leadsService.getClaimPolicy();
      setClaimPolicy(policy);
    } catch {
      setClaimPolicy(null);
    }
  }, [isAdmin]);

  const fetchPendingReleaseRequests = useCallback(async () => {
    if (!isAdmin) {
      setPendingReleaseRequests([]);
      setPendingReleaseTotal(0);
      return;
    }

    try {
      const response = await leadsService.getPendingReleaseRequests(6);
      setPendingReleaseRequests(response.requests);
      setPendingReleaseTotal(response.total);
    } catch {
      setPendingReleaseRequests([]);
      setPendingReleaseTotal(0);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchClaimPolicy();
  }, [fetchClaimPolicy]);

  useEffect(() => {
    fetchPendingReleaseRequests();
  }, [fetchPendingReleaseRequests]);

  useEffect(() => {
    if (!isAdmin) return;

    studentsService
      .getAll({ limit: 1000 })
      .then((response) =>
        setStudents(response.users.filter((student) => student.role === 'STUDENT' && student.active))
      );
  }, [isAdmin]);

  const pendingReleaseLeadIds = useMemo(
    () => new Set(pendingReleaseRequests.map((request) => request.lead.id)),
    [pendingReleaseRequests]
  );

  const handleClaim = async (id: string) => {
    try {
      await leadsService.claim(id);
      toast.success('تم حجز العميل بنجاح');
      await Promise.all([fetchLeads(), fetchClaimPolicy()]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;

    try {
      await leadsService.delete(id);
      toast.success('تم حذف العميل');
      await Promise.all([fetchLeads(), fetchPendingReleaseRequests()]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchLeads(), fetchClaimPolicy(), fetchPendingReleaseRequests()]);
  };

  const title = isAdmin ? 'إدارة العملاء' : 'العملاء المتاحين';
  const subtitle = isAdmin
    ? `إجمالي ${total} عميل`
    : claimPolicy?.activeLeadReservationLimit && claimPolicy.activeLeadReservationLimit > 0
      ? `${total} عميل متاح للحجز · المتبقي لك ${claimPolicy.remainingClaims ?? 0}`
      : `${total} عميل متاح للحجز`;
  const canClaimLead = isAdmin || claimPolicy?.canClaimNewLeads !== false;

  return (
    <div>
      <Header
        title={title}
        subtitle={subtitle}
        actions={
          isAdmin ? (
            <button
              onClick={() => {
                setEditLead(null);
                setShowForm(true);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              عميل جديد
            </button>
          ) : undefined
        }
      />

      {isAdmin ? (
        <PendingReleaseRequestsAlert
          total={pendingReleaseTotal}
          requests={pendingReleaseRequests}
          className="mb-4"
        />
      ) : null}

      <Link
        href="/coach"
        className="mb-4 block overflow-hidden rounded-2xl border border-sky-100 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                تدريب سريع
              </div>
              <h3 className="mt-1 text-sm font-bold text-gray-900">
                جرّب عميل AI عشوائي للتدريب على البيع قبل متابعة العملاء الحقيقيين
              </h3>
              <p className="mt-1 text-xs leading-6 text-gray-600">
                كل مرة ستحصل على شخصية مختلفة، نشاط مختلف، واعتراضات مختلفة وكأنك تتعامل مع عميل حقيقي.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm">
            افتح المدرب الذكي
          </span>
        </div>
      </Link>

      {!isAdmin && claimPolicy ? (
        <div
          className={`mb-4 rounded-2xl border p-4 ${
            claimPolicy.canClaimNewLeads ? 'border-emerald-100 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/80'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
                claimPolicy.canClaimNewLeads ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {claimPolicy.canClaimNewLeads ? (
                <CircleAlert className="h-5 w-5" />
              ) : (
                <LockKeyhole className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">
                {claimPolicy.canClaimNewLeads ? 'يمكنك حجز عملاء جدد الآن' : 'حجز العملاء الجدد متوقف لهذا الحساب'}
              </p>
              <p className="mt-1 text-sm leading-7 text-slate-600">
                {claimPolicy.reason ||
                  (claimPolicy.activeLeadReservationLimit && claimPolicy.activeLeadReservationLimit > 0
                    ? `لديك ${claimPolicy.activeLeadCount} عميل نشط من أصل ${claimPolicy.activeLeadReservationLimit}.`
                    : `لديك ${claimPolicy.activeLeadCount} عميل نشط حاليًا ولا يوجد حد عام مفعل.`)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                أدوات التدريب ما زالت متاحة لك من صفحة{' '}
                <Link href="/coach" className="font-semibold text-primary hover:underline">
                  المدرب الذكي
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            className="input-field pr-9"
            placeholder="ابحث بالاسم أو الهاتف..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        {isAdmin ? (
          <select
            className="input-field min-w-[150px] w-auto"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        ) : null}
        <button onClick={handleRefresh} className="btn-secondary flex items-center gap-1">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : leads.length === 0 ? (
        <EmptyState icon="📋" title="لا توجد عملاء" description="لا توجد نتائج مطابقة لبحثك" />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {leads.map((lead) => {
              const isPendingReleaseLead = isAdmin && pendingReleaseLeadIds.has(lead.id);

              return (
                <div
                  key={lead.id}
                  className={`card p-4 ${
                    isPendingReleaseLead ? 'border border-amber-200 bg-amber-50/40 ring-1 ring-amber-100' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/leads/${lead.id}`} className="font-semibold text-gray-900 hover:text-primary">
                        {lead.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-400" dir="ltr">
                        {lead.phone}
                      </p>
                      {lead.service ? <p className="mt-1 text-xs text-gray-500">{lead.service}</p> : null}
                      {isAdmin && lead.assignedTo ? (
                        <p className="mt-1 text-xs text-gray-400">المسؤول: {lead.assignedTo.name}</p>
                      ) : null}
                      {isPendingReleaseLead ? (
                        <p className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                          طلب إعادة بانتظار المراجعة
                        </p>
                      ) : null}
                    </div>
                    <LeadStatusBadge status={lead.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
                    <Link href={`/leads/${lead.id}`} className="btn-ghost flex-1 py-1.5 px-3 text-center text-xs">
                      عرض
                    </Link>
                    {!isAdmin && lead.status === 'AVAILABLE' ? (
                      <button
                        onClick={() => handleClaim(lead.id)}
                        disabled={!canClaimLead}
                        className="btn-primary flex-1 py-1.5 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        title={!canClaimLead ? claimPolicy?.reason || 'لا يمكن حجز عملاء جدد حاليًا' : undefined}
                      >
                        {canClaimLead ? 'احجز' : 'مغلق'}
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => {
                            setEditLead(lead);
                            setShowForm(true);
                          }}
                          className="btn-ghost py-1.5 px-3 text-xs"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setAssignLead(lead)} className="btn-ghost py-1.5 px-3 text-xs">
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="rounded-lg py-1.5 px-3 text-xs text-error hover:bg-error-container"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">الاسم</th>
                  <th className="table-header">الهاتف</th>
                  <th className="table-header">الخدمة</th>
                  <th className="table-header">المصدر</th>
                  <th className="table-header">الحالة</th>
                  {isAdmin ? <th className="table-header">المسؤول</th> : null}
                  <th className="table-header">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const isPendingReleaseLead = isAdmin && pendingReleaseLeadIds.has(lead.id);

                  return (
                    <tr key={lead.id} className={`table-row ${isPendingReleaseLead ? 'bg-amber-50/60' : ''}`}>
                      <td className="table-cell">
                        <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                          {lead.name}
                        </Link>
                        {isPendingReleaseLead ? (
                          <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                            طلب إعادة بانتظار المراجعة
                          </p>
                        ) : null}
                      </td>
                      <td className="table-cell" dir="ltr">
                        {lead.phone}
                      </td>
                      <td className="table-cell">{lead.service || '—'}</td>
                      <td className="table-cell">{lead.source || '—'}</td>
                      <td className="table-cell">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      {isAdmin ? (
                        <td className="table-cell">
                          {lead.assignedTo?.name || <span className="text-gray-400">غير محدد</span>}
                        </td>
                      ) : null}
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <Link href={`/leads/${lead.id}`} className="btn-ghost py-1 px-2 text-xs">
                            عرض
                          </Link>
                          {!isAdmin && lead.status === 'AVAILABLE' ? (
                            <button
                              onClick={() => handleClaim(lead.id)}
                              disabled={!canClaimLead}
                              className="btn-primary py-1 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                              title={!canClaimLead ? claimPolicy?.reason || 'لا يمكن حجز عملاء جدد حاليًا' : undefined}
                            >
                              {canClaimLead ? 'احجز' : 'مغلق'}
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditLead(lead);
                                  setShowForm(true);
                                }}
                                className="btn-ghost py-1 px-2 text-xs"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button onClick={() => setAssignLead(lead)} className="btn-ghost py-1 px-2 text-xs">
                                <UserPlus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(lead.id)}
                                className="rounded py-1 px-2 text-xs text-error hover:bg-error-container"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
      />

      {showForm ? (
        <LeadFormModal
          lead={editLead}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchLeads();
          }}
        />
      ) : null}

      {assignLead ? (
        <AssignModal
          lead={assignLead}
          students={students}
          onClose={() => setAssignLead(null)}
          onSaved={() => {
            setAssignLead(null);
            fetchLeads();
          }}
        />
      ) : null}
    </div>
  );
}
