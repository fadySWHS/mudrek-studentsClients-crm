'use client';
import { useEffect, useState } from 'react';
import { reportsService, DashboardStats, StudentPerformance } from '@/services/reports';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { TrendingUp, Award, Target } from 'lucide-react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [performance, setPerformance] = useState<StudentPerformance[]>([]);
  const [lostReasons, setLostReasons] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsService.getDashboard(),
      reportsService.getStudentPerformance(),
      reportsService.getLostReasons(),
    ]).then(([s, p, l]) => {
      setStats(s);
      setPerformance(p.sort((a, b) => b.closedWon - a.closedWon));
      setLostReasons(l);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!stats) return null;

  const totalClosed = stats.leads.closedWon + stats.leads.closedLost;
  const winRate = totalClosed > 0 ? Math.round((stats.leads.closedWon / totalClosed) * 100) : 0;

  return (
    <div>
      <Header title="تحليلات الأداء" subtitle="نظرة شاملة على أداء الفريق والعملاء" />

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPI label="إجمالي العملاء" value={stats.leads.total} icon={<Target className="h-5 w-5" />} color="primary" />
        <KPI label="نسبة النجاح" value={`${winRate}%`} icon={<TrendingUp className="h-5 w-5" />} color="success" />
        <KPI label="صفقات ناجحة" value={stats.leads.closedWon} icon={<Award className="h-5 w-5" />} color="green" />
        <KPI label="صفقات خسارة" value={stats.leads.closedLost} icon={<Award className="h-5 w-5" />} color="error" />
      </div>

      {/* Lead funnel */}
      <div className="card mb-6">
        <h2 className="font-bold text-gray-900 mb-4">توزيع العملاء</h2>
        <div className="space-y-3">
          {[
            { label: 'متاح', value: stats.leads.available, color: 'bg-emerald-400' },
            { label: 'محجوز / في تقدم', value: stats.leads.active, color: 'bg-blue-400' },
            { label: 'مغلق ناجح', value: stats.leads.closedWon, color: 'bg-green-500' },
            { label: 'مغلق خسارة', value: stats.leads.closedLost, color: 'bg-red-400' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{item.label}</span>
                <span className="font-semibold text-gray-900">{item.value}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  style={{ width: stats.leads.total > 0 ? `${(item.value / stats.leads.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student performance */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">ترتيب الطلاب</h2>
          {performance.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-3">
              {performance.map((s, i) => {
                const rate = s.total > 0 ? Math.round((s.closedWon / s.total) * 100) : 0;
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-surface text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900 truncate">{s.name}</span>
                        <span className="text-gray-400 flex-shrink-0 mr-2">{s.total} عميل</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary flex-shrink-0">{rate}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lost reasons */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-4">أسباب الخسارة</h2>
          {Object.keys(lostReasons).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(lostReasons)
                .sort(([, a], [, b]) => b - a)
                .map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 truncate flex-1 ml-3">{reason}</span>
                    <span className="badge bg-red-50 text-red-600 flex-shrink-0">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-green-50 text-green-600',
    green: 'bg-green-50 text-green-700',
    error: 'bg-error-container text-error',
  };
  return (
    <div className="stat-card">
      <div className={`p-3 rounded-xl ${colorMap[color] || colorMap.primary}`}>{icon}</div>
      <div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
