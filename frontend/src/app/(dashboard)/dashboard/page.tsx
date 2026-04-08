'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { reportsService, DashboardStats, StudentPerformance } from '@/services/reports';
import { leadsService, Lead } from '@/services/leads';
import { remindersService, Reminder } from '@/services/leads';
import Link from 'next/link';
import Pagination from '@/components/shared/Pagination';
import { TrendingUp, Users, Briefcase, AlertCircle, CheckCircle, XCircle, Clock, Bell } from 'lucide-react';
import LeadStatusBadge from '@/components/shared/LeadStatusBadge';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function DashboardPage() {
  const { isAdmin, user } = useAuth();

  return isAdmin ? <AdminDashboard /> : <StudentDashboard />;
}

/* ─── Admin Dashboard ─── */
function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [performance, setPerformance] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [perfPage, setPerfPage] = useState(1);
  const [perfLimit, setPerfLimit] = useState(10);

  useEffect(() => {
    Promise.all([
      reportsService.getDashboard(),
      reportsService.getStudentPerformance(),
    ]).then(([s, p]) => {
      setStats(s);
      setPerformance(p);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!stats) return null;

  const statCards = [
    { label: 'إجمالي العملاء', value: stats.leads.total, icon: Briefcase, color: 'text-primary', bg: 'bg-primary-light' },
    { label: 'متاح للحجز', value: stats.leads.available, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'صفقات ناجحة', value: stats.leads.closedWon, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'متأخر عن الموعد', value: stats.overdueReminders, icon: AlertCircle, color: 'text-error', bg: 'bg-error-container' },
    { label: 'الطلاب النشطاء', value: stats.students.active, icon: Users, color: 'text-secondary', bg: 'bg-secondary-light' },
    { label: 'خسائر مغلقة', value: stats.leads.closedLost, icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-100' },
  ];

  return (
    <div>
      <Header title="لوحة التحكم" subtitle={`مرحباً، تفضّل بنظرة عامة على أداء الفريق`} />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className={`${s.bg} p-3 rounded-xl`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Student Performance Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">أداء الطلاب</h2>
          <Link href="/analytics" className="btn-ghost text-xs">عرض التفاصيل</Link>
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
              {performance.slice((perfPage - 1) * perfLimit, perfPage * perfLimit).map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell font-medium">{s.name}</td>
                  <td className="table-cell">{s.total}</td>
                  <td className="table-cell text-green-600 font-medium">{s.closedWon}</td>
                  <td className="table-cell text-error">{s.closedLost}</td>
                  <td className="table-cell">
                    {s.total > 0
                      ? <span className="font-semibold text-primary">{Math.round((s.closedWon / s.total) * 100)}%</span>
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                </tr>
              ))}
              {performance.length === 0 && (
                <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">لا توجد بيانات بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {performance.length > perfLimit && (
          <Pagination
            page={perfPage}
            limit={perfLimit}
            total={performance.length}
            onPageChange={setPerfPage}
            onLimitChange={(l) => { setPerfLimit(l); setPerfPage(1); }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Student Dashboard ─── */
function StudentDashboard() {
  const { user } = useAuth();
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [available, setAvailable] = useState<number>(0);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      leadsService.getAll({ assignedTo: user?.id, limit: 5 }),
      leadsService.getAll({ status: 'AVAILABLE', limit: 1 }),
      remindersService.getAll(),
    ]).then(([mine, avail, rems]) => {
      setMyLeads(mine.leads);
      setAvailable(avail.total);
      setReminders(rems.filter((r) => r.status === 'PENDING'));
    }).finally(() => setLoading(false));
  }, [user?.id]);

  const overdueCount = reminders.filter((r) => isPast(new Date(r.dueAt))).length;

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div>
      <Header title={`مرحباً، ${user?.name?.split(' ')[0]} 👋`} subtitle="إليك ملخص يومك" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="bg-primary-light p-3 rounded-xl">
            <Briefcase className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{myLeads.length}</p>
            <p className="text-xs text-gray-500">عملائي</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="bg-emerald-50 p-3 rounded-xl">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{available}</p>
            <p className="text-xs text-gray-500">متاح للحجز</p>
          </div>
        </div>
        <div className="stat-card">
          <div className={`${overdueCount > 0 ? 'bg-error-container' : 'bg-amber-50'} p-3 rounded-xl`}>
            <Clock className={`h-5 w-5 ${overdueCount > 0 ? 'text-error' : 'text-amber-600'}`} />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{overdueCount}</p>
            <p className="text-xs text-gray-500">متأخر عن الموعد</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link href="/leads" className="card hover:shadow-elevated transition-shadow text-center py-6 cursor-pointer">
          <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="font-semibold text-gray-900 text-sm">العملاء المتاحين</p>
          <p className="text-xs text-gray-400 mt-0.5">احجز عميلاً جديداً</p>
        </Link>
        <Link href="/follow-ups" className="card hover:shadow-elevated transition-shadow text-center py-6 cursor-pointer">
          <Bell className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="font-semibold text-gray-900 text-sm">المتابعات</p>
          <p className="text-xs text-gray-400 mt-0.5">{reminders.length} متابعة معلقة</p>
        </Link>
      </div>

      {/* Recent leads */}
      {myLeads.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">آخر عملائي</h2>
            <Link href="/my-leads" className="btn-ghost text-xs">عرض الكل</Link>
          </div>
          <div className="space-y-3">
            {myLeads.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface transition-colors">
                <div>
                  <p className="font-medium text-sm text-gray-900">{lead.name}</p>
                  <p className="text-xs text-gray-400">{lead.phone}</p>
                </div>
                <LeadStatusBadge status={lead.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

