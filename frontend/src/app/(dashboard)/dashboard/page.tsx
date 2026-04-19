'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isPast } from 'date-fns';
import {
  AlertCircle,
  Bell,
  Briefcase,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import Header from '@/components/layout/Header';
import PendingReleaseRequestsAlert from '@/components/leads/PendingReleaseRequestsAlert';
import LeadStatusBadge from '@/components/shared/LeadStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Pagination from '@/components/shared/Pagination';
import { useAuth } from '@/context/AuthContext';
import {
  Lead,
  PendingLeadReleaseRequest,
  Reminder,
  leadsService,
  remindersService,
} from '@/services/leads';
import { DashboardStats, StudentPerformance, reportsService } from '@/services/reports';

export default function DashboardPage() {
  const { isAdmin } = useAuth();

  return isAdmin ? <AdminDashboard /> : <StudentDashboard />;
}

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [performance, setPerformance] = useState<StudentPerformance[]>([]);
  const [pendingReleaseRequests, setPendingReleaseRequests] = useState<PendingLeadReleaseRequest[]>([]);
  const [pendingReleaseTotal, setPendingReleaseTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [perfPage, setPerfPage] = useState(1);
  const [perfLimit, setPerfLimit] = useState(10);

  useEffect(() => {
    Promise.all([
      reportsService.getDashboard(),
      reportsService.getStudentPerformance(),
      leadsService.getPendingReleaseRequests(3),
    ])
      .then(([dashboardStats, studentPerformance, pending]) => {
        setStats(dashboardStats);
        setPerformance(studentPerformance);
        setPendingReleaseRequests(pending.requests);
        setPendingReleaseTotal(pending.total);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      label: 'إجمالي العملاء',
      value: stats.leads.total,
      icon: Briefcase,
      color: 'text-primary',
      bg: 'bg-primary-light',
    },
    {
      label: 'متاح للحجز',
      value: stats.leads.available,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'صفقات ناجحة',
      value: stats.leads.closedWon,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'متأخر عن الموعد',
      value: stats.overdueReminders,
      icon: AlertCircle,
      color: 'text-error',
      bg: 'bg-error-container',
    },
    {
      label: 'الطلاب النشطون',
      value: stats.students.active,
      icon: Users,
      color: 'text-secondary',
      bg: 'bg-secondary-light',
    },
    {
      label: 'خسائر مغلقة',
      value: stats.leads.closedLost,
      icon: XCircle,
      color: 'text-gray-500',
      bg: 'bg-gray-100',
    },
  ];

  return (
    <div>
      <Header title="لوحة التحكم" subtitle="مرحبًا، تفضل بنظرة عامة على أداء الفريق" />

      <PendingReleaseRequestsAlert
        total={pendingReleaseTotal}
        requests={pendingReleaseRequests}
        className="mb-6"
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className={`${card.bg} rounded-xl p-3`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">أداء الطلاب</h2>
          <Link href="/analytics" className="btn-ghost text-xs">
            عرض التفاصيل
          </Link>
        </div>
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">الطالب</th>
                <th className="table-header">المجموع</th>
                <th className="table-header">ناجح</th>
                <th className="table-header">خسارة</th>
                <th className="table-header">نسبة النجاح</th>
              </tr>
            </thead>
            <tbody>
              {performance.slice((perfPage - 1) * perfLimit, perfPage * perfLimit).map((student) => (
                <tr key={student.id} className="table-row">
                  <td className="table-cell font-medium">{student.name}</td>
                  <td className="table-cell">{student.total}</td>
                  <td className="table-cell font-medium text-green-600">{student.closedWon}</td>
                  <td className="table-cell text-error">{student.closedLost}</td>
                  <td className="table-cell">
                    {student.total > 0 ? (
                      <span className="font-semibold text-primary">
                        {Math.round((student.closedWon / student.total) * 100)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {performance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell py-8 text-center text-gray-400">
                    لا توجد بيانات بعد
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {performance.length > perfLimit ? (
          <Pagination
            page={perfPage}
            limit={perfLimit}
            total={performance.length}
            onPageChange={setPerfPage}
            onLimitChange={(nextLimit) => {
              setPerfLimit(nextLimit);
              setPerfPage(1);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function StudentDashboard() {
  const { user } = useAuth();
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [available, setAvailable] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      leadsService.getAll({ assignedTo: user?.id, limit: 5 }),
      leadsService.getAll({ status: 'AVAILABLE', limit: 1 }),
      remindersService.getAll(),
    ])
      .then(([mine, avail, reminderItems]) => {
        setMyLeads(mine.leads);
        setAvailable(avail.total);
        setReminders(reminderItems.filter((reminder) => reminder.status === 'PENDING'));
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  const overdueCount = reminders.filter((reminder) => isPast(new Date(reminder.dueAt))).length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <Header title={`مرحبًا، ${user?.name?.split(' ')[0]} 👋`} subtitle="إليك ملخص يومك" />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="stat-card">
          <div className="rounded-xl bg-primary-light p-3">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{myLeads.length}</p>
            <p className="text-xs text-gray-500">عملائي</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="rounded-xl bg-emerald-50 p-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{available}</p>
            <p className="text-xs text-gray-500">متاح للحجز</p>
          </div>
        </div>
        <div className="stat-card">
          <div className={`rounded-xl p-3 ${overdueCount > 0 ? 'bg-error-container' : 'bg-amber-50'}`}>
            <Clock className={`h-5 w-5 ${overdueCount > 0 ? 'text-error' : 'text-amber-600'}`} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{overdueCount}</p>
            <p className="text-xs text-gray-500">متأخر عن الموعد</p>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <Link href="/leads" className="card cursor-pointer py-6 text-center transition-shadow hover:shadow-elevated">
          <TrendingUp className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-sm font-semibold text-gray-900">العملاء المتاحين</p>
          <p className="mt-0.5 text-xs text-gray-400">احجز عميلًا جديدًا</p>
        </Link>
        <Link
          href="/follow-ups"
          className="card cursor-pointer py-6 text-center transition-shadow hover:shadow-elevated"
        >
          <Bell className="mx-auto mb-2 h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-gray-900">المتابعات</p>
          <p className="mt-0.5 text-xs text-gray-400">{reminders.length} متابعة معلقة</p>
        </Link>
      </div>

      {myLeads.length > 0 ? (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">آخر عملائي</h2>
            <Link href="/my-leads" className="btn-ghost text-xs">
              عرض الكل
            </Link>
          </div>
          <div className="space-y-3">
            {myLeads.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-surface"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                  <p className="text-xs text-gray-400">{lead.phone}</p>
                </div>
                <LeadStatusBadge status={lead.status} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
