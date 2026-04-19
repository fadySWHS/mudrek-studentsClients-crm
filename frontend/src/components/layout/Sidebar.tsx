'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  Bot,
  Briefcase,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { leadsService } from '@/services/leads';
import { cn } from '@/utils/cn';

interface SidebarNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  showPendingBadge?: boolean;
}

const studentNav: SidebarNavItem[] = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/leads', label: 'العملاء المتاحين', icon: Briefcase },
  { href: '/my-leads', label: 'عملائي', icon: UserCheck },
  { href: '/follow-ups', label: 'المتابعات', icon: Bell },
  { href: '/coach', label: 'المدرب الذكي', icon: Bot },
];

const adminNav: SidebarNavItem[] = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/leads', label: 'إدارة العملاء', icon: Briefcase, showPendingBadge: true },
  { href: '/students', label: 'المستخدمون', icon: Users },
  { href: '/analytics', label: 'التحليلات', icon: BarChart2 },
  { href: '/activity', label: 'سجل النشاط', icon: Activity },
  { href: '/coach', label: 'المدرب الذكي', icon: Bot },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();
  const [pendingReleaseCount, setPendingReleaseCount] = useState(0);
  const navItems = isAdmin ? adminNav : studentNav;

  useEffect(() => {
    let active = true;

    if (!isAdmin) {
      setPendingReleaseCount(0);
      return () => {
        active = false;
      };
    }

    leadsService
      .getPendingReleaseRequests(1)
      .then((response) => {
        if (active) {
          setPendingReleaseCount(response.total);
        }
      })
      .catch(() => {
        if (active) {
          setPendingReleaseCount(0);
        }
      });

    return () => {
      active = false;
    };
  }, [isAdmin, pathname]);

  return (
    <>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onMobileClose} />
      ) : null}

      <aside
        className={cn(
          'fixed top-0 right-0 z-50 flex h-full w-64 translate-x-full flex-col border-l border-gray-100 bg-white shadow-card transition-transform duration-300 md:translate-x-0',
          mobileOpen && 'translate-x-0'
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="مدرك" className="h-10 w-10 rounded-full object-contain drop-shadow-sm" />
            <div>
              <p className="text-sm font-bold leading-tight text-gray-900">مدرك</p>
              <p className="text-xs text-gray-400">نظام إدارة العملاء</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {isAdmin && pendingReleaseCount > 0 ? (
            <Link
              href="/leads"
              onClick={onMobileClose}
              className="block rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-right shadow-sm transition-colors hover:bg-amber-100/80"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-amber-700">تنبيه مراجعة</p>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-900">
                    يوجد {pendingReleaseCount} طلب إعادة عميل بانتظارك
                  </p>
                  <p className="mt-1 text-xs text-slate-600">افتح إدارة العملاء وراجع الطلبات المعلقة.</p>
                </div>
              </div>
            </Link>
          ) : null}

          <div className="space-y-1">
            {navItems.map(({ href, label, icon: Icon, showPendingBadge }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const showBadge = Boolean(showPendingBadge && pendingReleaseCount > 0);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    active ? 'bg-primary-light text-primary-dark' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : 'text-gray-400')} />
                    <span>{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {showBadge ? (
                      <span
                        className={cn(
                          'inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold',
                          active ? 'bg-primary text-white' : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {pendingReleaseCount}
                      </span>
                    ) : null}
                    {active ? <ChevronLeft className="h-3 w-3 text-primary" /> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-gray-100 px-4 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-light">
              <span className="text-xs font-bold text-primary">{user?.name?.[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-400">{isAdmin ? 'مدير' : 'طالب'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-error"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
