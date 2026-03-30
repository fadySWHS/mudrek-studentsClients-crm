'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { leadsService, Lead } from '@/services/leads';
import Header from '@/components/layout/Header';
import LeadStatusBadge from '@/components/shared/LeadStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import Pagination from '@/components/shared/Pagination';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function MyLeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setLoading(true);
    leadsService.getAll({ assignedTo: user?.id, search: search || undefined, page, limit })
      .then((res) => { setLeads(res.leads); setTotal(res.total); })
      .finally(() => setLoading(false));
  }, [user?.id, search, page, limit]);

  return (
    <div>
      <Header title="عملائي" subtitle={`${total} عميل مسجل باسمك`} />

      <div className="card mb-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input-field pr-9"
            placeholder="ابحث في عملائك..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon="📋"
            title="لا توجد عملاء بعد"
            description="احجز عميلاً من قائمة العملاء المتاحين"
            action={<Link href="/leads" className="btn-primary">تصفح العملاء المتاحين</Link>}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">الاسم</th>
                <th className="table-header">الهاتف</th>
                <th className="table-header">الخدمة</th>
                <th className="table-header">الحالة</th>
                <th className="table-header">تاريخ الحجز</th>
                <th className="table-header">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="table-row">
                  <td className="table-cell font-medium">{lead.name}</td>
                  <td className="table-cell" dir="ltr">{lead.phone}</td>
                  <td className="table-cell">{lead.service || '—'}</td>
                  <td className="table-cell"><LeadStatusBadge status={lead.status} /></td>
                  <td className="table-cell text-sm text-gray-400">
                    {format(new Date(lead.updatedAt), 'dd MMM yyyy', { locale: ar })}
                  </td>
                  <td className="table-cell">
                    <Link href={`/leads/${lead.id}`} className="btn-ghost py-1 px-3 text-xs">عرض التفاصيل</Link>
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
    </div>
  );
}
