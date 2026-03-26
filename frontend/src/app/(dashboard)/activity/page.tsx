'use client';
import { useEffect, useState, useCallback } from 'react';
import { activityService, ActivityEntry } from '@/services/activity';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import Link from 'next/link';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { History } from 'lucide-react';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATED:      { label: 'إنشاء عميل',      color: 'bg-blue-100 text-blue-700' },
  CLAIMED:      { label: 'حجز عميل',         color: 'bg-emerald-100 text-emerald-700' },
  STATUS_CHANGE:{ label: 'تغيير حالة',       color: 'bg-amber-100 text-amber-700' },
  ASSIGNED:     { label: 'تعيين',            color: 'bg-purple-100 text-purple-700' },
  DELETED:      { label: 'حذف عميل',         color: 'bg-red-100 text-red-700' },
};

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityService.getLog({ page, limit: 50 });
      setEntries(res.history);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  return (
    <div>
      <Header title="سجل النشاط" subtitle={`${total} إجراء مسجل`} />

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon="📋" title="لا يوجد نشاط بعد" />
      ) : (
        <>
          <div className="card">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute right-6 top-0 bottom-0 w-0.5 bg-gray-100" />

              <div className="space-y-0">
                {entries.map((entry, i) => {
                  const action = ACTION_LABELS[entry.actionType] ?? { label: entry.actionType, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={entry.id} className="flex gap-5 pb-6 relative">
                      {/* Dot */}
                      <div className="w-12 flex-shrink-0 flex justify-center pt-1">
                        <div className="w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm z-10" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-surface rounded-xl p-4 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`badge text-xs ${action.color}`}>{action.label}</span>
                            <span className="text-sm font-semibold text-gray-900">{entry.actor.name}</span>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {format(new Date(entry.createdAt), 'dd MMM yyyy — hh:mm a', { locale: ar })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <span>عميل:</span>
                          <Link href={`/leads/${entry.lead.id}`} className="text-primary font-medium hover:underline">
                            {entry.lead.name}
                          </Link>
                        </div>

                        {entry.actionType === 'STATUS_CHANGE' && entry.fromValue && entry.toValue && (
                          <p className="text-xs text-gray-400 mt-1">
                            {entry.fromValue} → {entry.toValue}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary py-1.5 px-4 disabled:opacity-40">السابق</button>
              <span className="text-sm text-gray-500">صفحة {page} من {Math.ceil(total / 50)}</span>
              <button disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)} className="btn-secondary py-1.5 px-4 disabled:opacity-40">التالي</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
