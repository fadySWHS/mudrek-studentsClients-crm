'use client';
import { useEffect, useState } from 'react';
import { settingsService, SystemSetting } from '@/services/settings';
import { studentsService } from '@/services/students';
import Header from '@/components/layout/Header';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertTriangle, Wifi, Info } from 'lucide-react';
import { cn } from '@/utils/cn';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<'twochat' | 'sheets' | 'webhook' | null>(null);
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

  const handleTestWebhook = async () => {
    setTesting('webhook');
    try {
      const msg = await settingsService.testWebhook();
      toast.success(msg);
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
  const webhookSettings = settings.filter((s) => s.key.startsWith('API_WEBHOOK'));
  const aiSettings = settings.filter((s) => s.key.startsWith('OPEN'));
  const systemSettings = settings.filter((s) => s.key === 'DEFAULT_STUDENT_PASSWORD');

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000'}/api/webhooks/make`;

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
          <GoogleSheetsHelp />
          {syncResult && (
            <div className="mt-3 bg-green-50 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              آخر مزامنة: {syncResult.created} جديد · {syncResult.updated} محدّث · {syncResult.disabled} معطّل
            </div>
          )}
        </SettingsCard>

        {/* ─── Make.com Webhook ─── */}
        <SettingsCard
          icon="🔗"
          title="Make.com / Zapier Webhook"
          subtitle="استقبال العملاء تلقائيًا من المنصات الخارجية"
          testLabel="اختبار Webhook"
          onTest={handleTestWebhook}
          testing={testing === 'webhook'}
        >
          {webhookSettings.map((s) => (
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
          
          <div className="bg-surface rounded-xl p-4 mt-4 border border-blue-100">
            <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> كيفية ربط Webhook
            </h4>
            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <p>في منصة Make.com أو Zapier، قم بإنشاء وحدة <strong className="text-gray-900">HTTP Make a request</strong> بالبيانات التالية:</p>
              
              <div className="bg-gray-50 p-2 rounded border font-mono">
                <div className="text-gray-500 mb-1">URL:</div>
                <div className="text-blue-600 break-all select-all font-semibold" dir="ltr">{webhookUrl}</div>
                
                <div className="text-gray-500 mt-2 mb-1">Method: <strong className="text-gray-900">POST</strong></div>
                <div className="text-gray-500 mt-2 mb-1">Headers:</div>
                <div className="text-gray-800" dir="ltr">Authorization: [الرمز السري الموضح أعلاه]</div>
                
                <div className="text-gray-500 mt-2 mb-1">Body type: <strong className="text-gray-900">Raw → JSON</strong></div>
                <pre className="text-green-700 bg-green-50/50 p-2 mt-1 rounded" dir="ltr">{`{
  "name": "اسم العميل",
  "phone": "رقم الهاتف",
  "service": "اسم الخدمة أو المنتج",
  "source": "Facebook Ads / TikTok / الخ",
  "budget": "مثال: 1000 ريال",
  "notes": "ملاحظات إضافية"
}`}</pre>
              </div>
            </div>
          </div>
        </SettingsCard>

        {/* ─── AI / OpenRouter & OpenAI ─── */}
        <SettingsCard
          icon="🤖"
          title="الذكاء الاصطناعي (OpenRouter & OpenAI)"
          subtitle="إعدادات مساعد المبيعات الذكي للطلاب وتحليل الصوت"
        >
          {aiSettings.map((s) => (
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

        {/* ─── System Settings ─── */}
        <SettingsCard
          icon="⚙️"
          title="إعدادات النظام العامة"
          subtitle="كلمة المرور الافتراضية للطلاب وإعدادات النظام الأخرى"
        >
          {systemSettings.map((s) => (
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
              { label: 'الخادم', value: 'VPS + Traefik/Docker' },
              { label: 'قاعدة البيانات', value: 'PostgreSQL' },
              { label: 'إصدار التطبيق', value: `v${process.env.NEXT_PUBLIC_APP_VERSION || '1.0.3'}` },
              { label: 'آخر تحديث', value: process.env.NEXT_PUBLIC_BUILD_DATE || '9 أبريل 2026 (Fix 2Chat Timeout)' },
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

function GoogleSheetsHelp() {
  return (
    <details className="mt-4 group bg-blue-50/50 border border-blue-100 rounded-xl overflow-hidden text-sm">
      <summary className="flex items-center gap-2 p-3 font-semibold text-blue-800 cursor-pointer hover:bg-blue-50 transition-colors">
        <Info className="h-4 w-4" />
        كيفية إعداد Google Sheets (الحصول على بيانات الارتباط)
      </summary>
      <div className="p-4 pt-0 text-gray-700 leading-relaxed space-y-4 border-t border-blue-100/50 mt-2">
        <div>
          <h4 className="font-bold text-gray-900 mb-1">1. إنشاء مشروع وتفعيل الـ APIs</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>اذهب إلى <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a>.</li>
            <li>قم بإنشاء مشروع جديد (New Project).</li>
            <li>من القائمة الجانبية (APIs & Services {'>'} Library)، ابحث عن <strong>Google Sheets API</strong> و <strong>Google Drive API</strong> وقم بتفعيلهما.</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 mb-1">2. استخراج ملف مفتاح الـ JSON</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>اذهب إلى <strong>IAM & Admin</strong> ثم <strong>Service Accounts</strong> وانقر على إنشاء حساب جديد.</li>
            <li>انقر على البريد الإلكتروني الخاص به، واذهب إلى تبويب <strong>Keys</strong>.</li>
            <li>اختر <strong>Add Key</strong> ثم <strong>Create new key</strong> بصيغة <strong>JSON</strong> لتنزيله.</li>
            <li>افتح الـ JSON، وانسخ <span className="underline">محتواه بالكامل</span> كـ نص واحد والصقه في إعداد <code>GOOGLE_SERVICE_ACCOUNT_JSON</code>.</li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold text-gray-900 mb-1">3. مشاركة Sheet وتعيين الـ ID</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>انسخ إيميل الـ Service Account (ينتهي بـ <code>iam.gserviceaccount.com</code>).</li>
            <li>افتح الـ Google Sheet واضغط <strong>Share</strong> (مشاركة) وأعطه صلاحية <strong>Editor</strong>.</li>
            <li>انسخ الـ <strong>Sheet ID</strong> من رابط المتصفح (بين <code>/d/</code> و <code>/edit</code>) وضعه في إعداد <code>GOOGLE_SHEET_ID</code>.</li>
          </ul>
        </div>
      </div>
    </details>
  );
}
