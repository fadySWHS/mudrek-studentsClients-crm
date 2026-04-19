import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Headphones,
  Mic,
  Sparkles,
  Waves,
} from 'lucide-react';

const coachTools = [
  {
    title: 'محاكاة عميل مباشر',
    description:
      'تدريب نصي حي على بدء التواصل، اكتشاف الاحتياج، وبناء الرد المناسب حسب شخصية العميل.',
    href: '/coach/client-roleplay',
    icon: Sparkles,
    badge: 'جلسات نصية',
    highlights: ['عميل جديد كل مرة', 'inbound أو outbound', 'اعتراضات متنوعة'],
    footer: 'مناسب لتدريب أول الرسائل ومرحلة الاكتشاف',
    accent:
      'border-sky-200 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f5fbff_100%)]',
    iconWrap: 'bg-sky-600',
  },
  {
    title: 'مراجع العروض والمقترحات',
    description:
      'ارفع العرض أو المقترح واحصل على مراجعة واضحة للنواقص، التخصيص، وقوة الإقناع قبل الإرسال.',
    href: '/coach/proposal-review',
    icon: FileText,
    badge: 'ملفات وعروض',
    highlights: ['PDF / DOCX / TXT', 'ملاحظات تخصيص', 'افتتاحية محسنة'],
    footer: 'مناسب قبل إرسال أي عرض للعميل',
    accent:
      'border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#fffaf2_100%)]',
    iconWrap: 'bg-amber-500',
  },
  {
    title: 'مكالمات صوتية تدريبية',
    description:
      'مكالمات مباشرة داخل المتصفح مع عميل عربي له رحلة بيع مستمرة من مكالمة إلى أخرى.',
    href: '/coach/voice-practice',
    icon: Waves,
    badge: 'Voice AI',
    highlights: ['رحلة عميل مستمرة', 'لهجات متعددة', 'مراحل بيع متدرجة'],
    footer: 'مناسب لتدريب المكالمات الحية والإغلاق',
    accent:
      'border-emerald-200 bg-[radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.16),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f4fff9_100%)]',
    iconWrap: 'bg-emerald-600',
  },
  {
    title: 'تحليل المكالمات المسجلة',
    description:
      'ارفع مكالمة مبيعات مسجلة ليتم تفريغها وتحليلها واستخراج نقاط التحسين العملية منها.',
    href: '/coach/call-analysis',
    icon: Headphones,
    badge: 'بعد المكالمة',
    highlights: ['تفريغ نصي', 'تقييم ونصائح', 'سجل مراجعات'],
    footer: 'مناسب لمراجعة الأداء بعد التواصل الحقيقي',
    accent:
      'border-violet-200 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f7f7ff_100%)]',
    iconWrap: 'bg-violet-600',
  },
];

export default function CoachPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-card">
        <div className="bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                  <Mic className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                    AI Coach Hub
                  </p>
                  <h1 className="text-3xl font-bold font-heading text-slate-900">
                    المدرب الذكي
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600">
                    اختر الأداة التي تريدها من الشبكة التالية. كل أداة الآن في صفحة مستقلة حتى يكون الدخول أسرع
                    والتركيز أوضح داخل كل مهمة.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                  4 أدوات مستقلة
                </span>
                <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                  تدريب نصي وصوتي
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  مراجعة قبل وبعد التواصل
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px]">
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">عدد الأدوات</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">4</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">الأسلوب</p>
                <p className="mt-2 text-sm font-bold text-slate-900">صفحات مستقلة</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">الاستخدام</p>
                <p className="mt-2 text-sm font-bold text-slate-900">اختر ثم افتح الأداة</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {coachTools.map(({ title, description, href, icon: Icon, badge, highlights, footer, accent, iconWrap }) => (
          <Link
            key={href}
            href={href}
            className={`group flex h-full flex-col overflow-hidden rounded-[28px] border p-6 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-xl ${accent}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <span className="inline-flex rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                  {badge}
                </span>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                  <p className="text-sm leading-7 text-slate-600">{description}</p>
                </div>
              </div>

              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition group-hover:scale-105 ${iconWrap}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {highlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/80 bg-white/75 p-4 text-sm leading-6 text-slate-600 shadow-sm">
              {footer}
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              افتح الأداة
              <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
