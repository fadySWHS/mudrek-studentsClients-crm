'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { leadsService, Lead, LeadStatus } from '@/services/leads';
import { studentsService, Student } from '@/services/students';
import Header from '@/components/layout/Header';
import LeadStatusBadge from '@/components/shared/LeadStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Search, Filter, RefreshCw, Trash2, Edit, UserPlus } from 'lucide-react';
import { leadStatusLabels } from '@/utils/leadStatus';
import { useRouter } from 'next/navigation';
import LeadFormModal from '@/components/leads/LeadFormModal';
import AssignModal from '@/components/leads/AssignModal';

const STATUSES: { value: string; label: string }[] = [
  { value: '', label: 'كل الحالات' },
  ...Object.entries(leadStatusLabels).map(([value, label]) => ({ value, label })),
];

export default function LeadsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
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

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadsService.getAll({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      });
      setLeads(res.leads);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page, limit]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (isAdmin) {
      // Need a large limit if we're capturing all active students for dropdown
      studentsService.getAll({ limit: 1000 }).then((res) => setStudents(res.users.filter((u) => u.role === 'STUDENT' && u.active)));
    }
  }, [isAdmin]);

  const handleClaim = async (id: string) => {
    try {
      await leadsService.claim(id);
      toast.success('تم حجز العميل بنجاح');
      fetchLeads();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
    try {
      await leadsService.delete(id);
      toast.success('تم حذف العميل');
      fetchLeads();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const title = isAdmin ? 'إدارة العملاء' : 'العملاء المتاحين';
  const subtitle = isAdmin ? `إجمالي ${total} عميل` : `${total} عميل متاح للحجز`;

  return (
    <div>
      <Header
        title={title}
        subtitle={subtitle}
        actions={isAdmin ? (
          <button onClick={() => { setEditLead(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            عميل جديد
          </button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input-field pr-9"
            placeholder="ابحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {isAdmin && (
          <select
            className="input-field w-auto min-w-[150px]"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
        <button onClick={fetchLeads} className="btn-secondary flex items-center gap-1">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon="📋"
            title="لا توجد عملاء"
            description="لا توجد نتائج مطابقة لبحثك"
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">الاسم</th>
                <th className="table-header">الهاتف</th>
                <th className="table-header">الخدمة</th>
                <th className="table-header">المصدر</th>
                <th className="table-header">الحالة</th>
                {isAdmin && <th className="table-header">المسؤول</th>}
                <th className="table-header">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="table-row">
                  <td className="table-cell">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                      {lead.name}
                    </Link>
                  </td>
                  <td className="table-cell" dir="ltr">{lead.phone}</td>
                  <td className="table-cell">{lead.service || '—'}</td>
                  <td className="table-cell">{lead.source || '—'}</td>
                  <td className="table-cell"><LeadStatusBadge status={lead.status} /></td>
                  {isAdmin && (
                    <td className="table-cell">{lead.assignedTo?.name || <span className="text-gray-400">غير محدد</span>}</td>
                  )}
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <Link href={`/leads/${lead.id}`} className="btn-ghost py-1 px-2 text-xs">عرض</Link>
                      {!isAdmin && lead.status === 'AVAILABLE' && (
                        <button onClick={() => handleClaim(lead.id)} className="btn-primary py-1 px-3 text-xs">احجز</button>
                      )}
                      {isAdmin && (
                        <>
                          <button onClick={() => { setEditLead(lead); setShowForm(true); }} className="btn-ghost py-1 px-2 text-xs">
                            <Edit className="h-3 w-3" />
                          </button>
                          <button onClick={() => setAssignLead(lead)} className="btn-ghost py-1 px-2 text-xs">
                            <UserPlus className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDelete(lead.id)} className="text-error hover:bg-error-container py-1 px-2 rounded text-xs">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      {showForm && (
        <LeadFormModal
          lead={editLead}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchLeads(); }}
        />
      )}

      {assignLead && (
        <AssignModal
          lead={assignLead}
          students={students}
          onClose={() => setAssignLead(null)}
          onSaved={() => { setAssignLead(null); fetchLeads(); }}
        />
      )}
    </div>
  );
}
