'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import AiSidebar from '@/components/ai/AiSidebar';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Menu } from 'lucide-react';
import { AiProvider } from '@/context/AiContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AiProvider>
      <div className="min-h-screen bg-surface flex">
        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 shadow-sm flex items-center justify-between px-4 z-30">
          <img src="/logo.png" alt="مدرك" className="w-8 h-8 object-contain rounded-full" />
          <p className="font-bold text-gray-900 text-sm">مدرك</p>
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <AiSidebar />

        <main className="flex-1 md:mr-64 p-4 md:p-6 pt-20 md:pt-6 overflow-y-auto min-h-screen">
          {children}
        </main>
      </div>
    </AiProvider>
  );
}
