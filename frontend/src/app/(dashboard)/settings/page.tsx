'use client';
import { useState } from 'react';
import { studentsService } from '@/services/students';
import Header from '@/components/layout/Header';
import toast from 'react-hot-toast';
import { RefreshCw, ExternalLink, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ created: number; updated: number } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await studentsService.syncFromSheets();
      setLastSync(result);
      toast.success(`تمت المزامنة: ${result.created} جديد، ${result.updated} محدّث`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <Header title="الإعدادات والتكاملات" subtitle="إدارة الاتصالات الخارجية وإعدادات النظام" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google Sheets */}
        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📊</div>
            <div>
              <h2 className="font-bold text-gray-900">Google Sheets</h2>
              <p className="text-sm text-gray-500">مزامنة قائمة الطلاب من جدول البيانات</p>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-4 mb-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">الاتصال</span>
              <span className="text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> مُهيّأ
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الجدول المرتبط</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">GOOGLE_SHEET_ID</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الجدولة</span>
              <span className="text-gray-700">يومياً الساعة 3:00 صباحاً</span>
            </div>
          </div>
          {lastSync && (
            <div className="bg-green-50 rounded-xl p-3 mb-3 text-sm text-green-700">
              آخر مزامنة: {lastSync.created} طالب جديد، {lastSync.updated} محدّث
            </div>
          )}
          <button onClick={handleSync} disabled={syncing} className="btn-primary w-full flex items-center justify-center gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'جارٍ المزامنة...' : 'مزامنة الآن'}
          </button>
        </div>

        {/* 2Chat WhatsApp */}
        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">💬</div>
            <div>
              <h2 className="font-bold text-gray-900">2Chat — WhatsApp</h2>
              <p className="text-sm text-gray-500">إشعارات المجموعة عند حجز العملاء</p>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">API Key</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">TWOCHAT_API_KEY</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">المجموعة المستهدفة</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">WHATSAPP_GROUP_ID</code>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الإشعار عند</span>
              <span className="text-gray-700">حجز عميل جديد</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            يتم الإرسال تلقائياً عند حجز طالب لعميل. لا يحتاج تفعيل يدوي.
          </p>
        </div>

        {/* Deployment */}
        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🚀</div>
            <div>
              <h2 className="font-bold text-gray-900">النشر</h2>
              <p className="text-sm text-gray-500">معلومات البيئة والخادم</p>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-sm space-y-2">
            {[
              { label: 'الخادم', value: 'VPS + Nginx + PM2' },
              { label: 'قاعدة البيانات', value: 'PostgreSQL' },
              { label: 'Backend URL', value: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between">
                <span className="text-gray-500">{item.label}</span>
                <span className="text-gray-700 font-medium text-xs">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GitHub */}
        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">⚙️</div>
            <div>
              <h2 className="font-bold text-gray-900">GitHub</h2>
              <p className="text-sm text-gray-500">إدارة الكود والنشر التلقائي</p>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">استراتيجية النشر</span>
              <span className="text-gray-700">git pull + pm2 restart</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الفرع الرئيسي</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">main</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
