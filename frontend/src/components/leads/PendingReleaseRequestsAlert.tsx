'use client';

import Link from 'next/link';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PendingLeadReleaseRequest } from '@/services/leads';
import { cn } from '@/utils/cn';

interface PendingReleaseRequestsAlertProps {
  total: number;
  requests: PendingLeadReleaseRequest[];
  className?: string;
}

export default function PendingReleaseRequestsAlert({
  total,
  requests,
  className,
}: PendingReleaseRequestsAlertProps) {
  if (!total) return null;

  const visibleRequests = requests.slice(0, 3);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_30%),linear-gradient(180deg,#fffdf7_0%,#fff7e6_100%)] p-4 shadow-sm',
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              إشعار يحتاج مراجعة فورية
            </div>
            <h2 className="mt-1 text-base font-black text-slate-900">
              يوجد {total} طلب {total === 1 ? 'إعادة عميل' : 'طلبات إعادة عملاء'} بانتظار قرار الإدارة
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              الطلب يبقى محتسبًا على الطالب حتى تتم مراجعته، لذلك يظهر هنا بشكل واضح مع روابط مباشرة لصفحات العملاء.
            </p>
          </div>
        </div>

        <Link
          href="/leads"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          افتح العملاء للمراجعة
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {visibleRequests.map((request) => (
          <Link
            key={request.id}
            href={`/leads/${request.lead.id}`}
            className="rounded-2xl border border-amber-200/70 bg-white/85 p-4 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{request.lead.name}</p>
                <p className="mt-1 text-xs text-slate-500" dir="ltr">
                  {request.lead.phone}
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                قيد المراجعة
              </span>
            </div>

            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <p>الطالب: {request.student.name}</p>
              <p>الموعد: {formatDate(request.createdAt)}</p>
              {request.lead.service ? <p>الخدمة: {request.lead.service}</p> : null}
            </div>

            {request.studentNote ? (
              <p className="mt-3 text-sm leading-6 text-slate-700">{truncate(request.studentNote, 180)}</p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">لا توجد ملاحظة مرفقة من الطالب.</p>
            )}
          </Link>
        ))}
      </div>

      {total > visibleRequests.length ? (
        <p className="mt-3 text-xs font-medium text-amber-800">
          وهناك {total - visibleRequests.length} طلبات أخرى تظهر داخل صفحة العملاء.
        </p>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return format(new Date(value), 'dd MMM yyyy · hh:mm a', { locale: ar });
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}
