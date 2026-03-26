'use client';
import { useEffect, useState } from 'react';
import { settingsService, SystemSetting } from '@/services/settings';
import { studentsService } from '@/services/students';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertTriangle, Wifi } from 'lucide-react';
import { cn } from '@/utils/cn';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<'twochat' | 'sheets' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; disabled: number } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsService.getAll();
      setSettings(data);
      const initial: Record<string, string> = {};
      data.forEach((s) => { initial[s.key] = ''; }); // start blank — user types new value to update
      setEditValues(initial);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async (key: string) => {
    const val = editValues[key]?.trim();
    if (!val) { toast.error('أدخل قيمة جديدة'); return; }
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      await settingsService.update(key, val);
      toast.success('تم حفظ الإعداد');
      setEditValues((p) => ({ ...p, [key]: '' }));
      fetchSettings();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const handleTestTwochat = async () => {
    setTesting('twochat');
    try {
      const msg = await settingsService.testTwochat();
      toast.success(msg);
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(null); }
  };

  const handleTestSheets = async () => {
    setTesting('sheets');
    try {
      const result = await settingsService.testSheets();
      toast.success(`الاتصال ناجح! أعمدة الجدول: ${result.headers.join(' · ')}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(null); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await studentsService.syncFromSheets();
      setSyncResult(result);
      toast.success(`المزامنة ناجحة: ${result.created} جديد · ${result.updated} محدّث · ${result.disabled} معطّل`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSyncing(false); }
  };

  const twochatSettings = settings.filter((s) => s.key.startsWith('TWOCHAT') || s.key.startsWith('WHATSAPP'));
  const sheetsSettings = settings.filter((s) => s.key.startsWith('GOOGLE'));

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div>
      <Header title="الإعدادات والتكاملات" subtitle="تحكم كامل في مفاتيح API والإعدادات من هنا" />

      <div className="space-y-6">
        {/* ─── 2Chat WhatsApp ─── */}
        <SettingsCard
          icon="💬"
          title="2Chat — WhatsApp"
          subtitle="إشعارات المجموعة عند حجز العملاء"
          testLabel="اختبار الإرسال"
          onTest={handleTestTwochat}
          testing={testing === 'twochat'}
        >
          {twochatSettings.map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              value={editValues[s.key] ?? ''}
              show={showValues[s.key] ?? false}
              saving={saving[s.key] ?? false}
              onChange={(v) => setEditValues((p) => ({ ...p, [s.key]: v }))}
              onToggleShow={() => setShowValues((p) => ({ ...p, [s.key]: !p[s.key] }))}
              onSave={() => handleSave(s.key)}
            />
          ))}
        </SettingsCard>

        {/* ─── Google Sheets ─── */}
        <SettingsCard
          icon="📊"
          title="Google Sheets"
          subtitle="مزامنة قائمة المستخدمين من جدول البيانات"
          testLabel="اختبار الاتصال"
          onTest={handleTestSheets}
          testing={testing === 'sheets'}
          extraAction={
            <button onClick={handleSync} disabled={syncing} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
              مزامنة الآن
            </button>
          }
        >
          {sheetsSettings.map((s) => (
            <SettingRow
              key={s.key}
              setting={s}
              value={editValues[s.key] ?? ''}
              show={showValues[s.key] ?? false}
              saving={saving[s.key] ?? false}
              onChange={(v) => setEditValues((p) => ({ ...p, [s.key]: v }))}
              onToggleShow={() => setShowValues((p) => ({ ...p, [s.key]: !p[s.key] }))}
              onSave={() => handleSave(s.key)}
            />
          ))}
          {syncResult && (
            <div className="mt-3 bg-green-50 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              آخر مزامنة: {syncResult.created} جديد · {syncResult.updated} محدّث · {syncResult.disabled} معطّل
            </div>
          )}
        </SettingsCard>

        {/* ─── Deployment Info ─── */}
        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🚀</div>
            <div>
              <h2 className="font-bold text-gray-900">معلومات النظام</h2>
              <p className="text-sm text-gray-500">بيئة التشغيل الحالية</p>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-sm space-y-2">
            {[
              { label: 'API URL', value: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api' },
              { label: 'الخادم', value: 'VPS + Nginx + PM2' },
              { label: 'قاعدة البيانات', value: 'PostgreSQL' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between">
                <span className="text-gray-500">{item.label}</span>
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">{item.value}</code>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function SettingsCard({
  icon, title, subtitle, children, testLabel, onTest, testing, extraAction,
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  testLabel?: string;
  onTest?: () => void;
  testing?: boolean;
  extraAction?: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
          <div>
            <h2 className="font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {extraAction}
          {onTest && (
            <button onClick={onTest} disabled={testing} className="btn-ghost flex items-center gap-1.5 text-sm border border-gray-200">
              <Wifi className={cn('h-4 w-4', testing && 'animate-pulse')} />
              {testing ? 'جارٍ الاختبار...' : testLabel}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingRow({
  setting, value, show, saving, onChange, onToggleShow, onSave,
}: {
  setting: SystemSetting;
  value: string;
  show: boolean;
  saving: boolean;
  onChange: (v: string) => void;
  onToggleShow: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-surface rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <label className="text-sm font-semibold text-gray-900">{setting.label}</label>
          {setting.description && (
            <p className="text-xs text-gray-400 mt-0.5">{setting.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mr-3">
          {setting.hasValue ? (
            <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />مُعيَّن
            </span>
          ) : (
            <span className="badge bg-amber-100 text-amber-700 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />غير مُعيَّن
            </span>
          )}
        </div>
      </div>

      {/* Current value preview */}
      {setting.hasValue && (
        <div className="text-xs text-gray-400 mb-2 font-mono">
          القيمة الحالية: {setting.sensitive ? '••••••••' : setting.value}
          {setting.updatedAt && (
            <span className="mr-2 text-gray-300">
              (آخر تحديث: {format(new Date(setting.updatedAt), 'dd MMM yyyy', { locale: ar })})
            </span>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={setting.sensitive && !show ? 'password' : 'text'}
            className="input-field text-xs font-mono pl-9"
            placeholder={setting.hasValue ? 'أدخل قيمة جديدة للتحديث...' : 'أدخل القيمة...'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            dir="ltr"
          />
          {setting.sensitive && (
            <button type="button" onClick={onToggleShow} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <button
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="btn-primary flex items-center gap-1.5 py-2 px-4 text-sm disabled:opacity-40"
        >
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          حفظ
        </button>
      </div>
    </div>
  );
}
