'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';
import {
  LayoutDashboard, Users, UserCheck, Bell, BarChart2,
  Settings, LogOut, ChevronLeft, Briefcase, Activity, X, Bot
} from 'lucide-react';

const studentNav = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/leads', label: 'العملاء المتاحين', icon: Briefcase },
  { href: '/my-leads', label: 'عملائي', icon: UserCheck },
  { href: '/follow-ups', label: 'المتابعات', icon: Bell },
  { href: '/coach', label: 'المدرب الذكي', icon: Bot },
];

const adminNav = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/leads', label: 'إدارة العملاء', icon: Briefcase },
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
  const navItems = isAdmin ? adminNav : studentNav;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 right-0 h-full w-64 bg-white border-l border-gray-100 shadow-card flex flex-col z-50 transition-transform duration-300',
        // Mobile: hidden by default (slide right), open when mobileOpen
        'translate-x-full md:translate-x-0',
        mobileOpen && 'translate-x-0',
      )}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="مدرك" className="w-10 h-10 object-contain drop-shadow-sm rounded-full" />
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">مدرك</p>
              <p className="text-xs text-gray-400">نظام إدارة العملاء</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button onClick={onMobileClose} className="md:hidden p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onMobileClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-primary-light text-primary-dark'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : 'text-gray-400')} />
                <span>{label}</span>
                {active && <ChevronLeft className="h-3 w-3 mr-auto text-primary" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold text-xs">{user?.name?.[0]}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400">{isAdmin ? 'مدير' : 'طالب'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-error hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
