'use client';
import { useEffect, useState } from 'react';
import { remindersService, Reminder } from '@/services/leads';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';

export default function FollowUpsPage() {
  const [reminders, setReminders] = useState<(Reminder & { lead?: { id: string; name: string; phone: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');

  useEffect(() => {
    remindersService.getAll()
      .then((data) => setReminders(data.filter((r) => r.status === 'PENDING')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = reminders.filter((r) => {
    const due = new Date(r.dueAt);
    if (filter === 'overdue') return isPast(due) && !isToday(due);
    if (filter === 'today') return isToday(due);
    if (filter === 'upcoming') return !isPast(due) && !isToday(due);
    return true;
  });

  const overdueCount = reminders.filter((r) => isPast(new Date(r.dueAt)) && !isToday(new Date(r.dueAt))).length;

  return (
    <div>
      <Header
        title="المتابعات"
        subtitle={`${reminders.length} متابعة معلقة${overdueCount > 0 ? ` · ${overdueCount} متأخرة` : ''}`}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'all', label: 'الكل' },
          { key: 'overdue', label: '⚠️ متأخرة', count: overdueCount },
          { key: 'today', label: 'اليوم' },
          { key: 'upcoming', label: 'قادمة' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
              filter === tab.key
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary hover:text-primary'
            )}
          >
            {tab.label}
            {'count' in tab && tab.count > 0 ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🎉"
          title="لا توجد متابعات"
          description="أنت في صدارة جدولك الزمني!"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const due = new Date(r.dueAt);
            const overdue = isPast(due) && !isToday(due);
            const today = isToday(due);

            return (
              <div key={r.id} className={cn('card flex items-start justify-between gap-4', overdue && 'border-error/30 bg-error-container/20')}>
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg mt-0.5', overdue ? 'bg-error-container' : today ? 'bg-amber-50' : 'bg-primary-light')}>
                    {overdue
                      ? <AlertCircle className="h-4 w-4 text-error" />
                      : <Clock className={`h-4 w-4 ${today ? 'text-amber-600' : 'text-primary'}`} />
                    }
                  </div>
                  <div>
                    <p className={cn('text-sm font-semibold', overdue ? 'text-error' : 'text-gray-900')}>
                      {format(due, 'EEEE، dd MMMM yyyy — hh:mm a', { locale: ar })}
                    </p>
                    {r.note && <p className="text-xs text-gray-500 mt-0.5">{r.note}</p>}
                    {overdue && <p className="text-xs text-error font-medium mt-1">متأخرة!</p>}
                    {today && <p className="text-xs text-amber-600 font-medium mt-1">اليوم</p>}
                  </div>
                </div>
                <Link href={`/leads/${r.leadId}`} className="btn-ghost py-1.5 px-3 text-xs flex-shrink-0">
                  عرض العميل
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
