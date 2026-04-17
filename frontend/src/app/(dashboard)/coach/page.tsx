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
      'تتدرّب على outreach واكتشاف الاحتياج والتعامل مع اعتراضات عميل عربي مختلف في كل جلسة.',
    href: '/coach/client-roleplay',
    icon: Sparkles,
    badge: 'جلسات نصية حية',
    bullets: ['عميل جديد كل مرة', 'سيناريو inbound أو outbound', 'اعتراضات وشخصيات متنوعة'],
    accent:
      'border-sky-200 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f4fbff_100%)]',
  },
  {
    title: 'مراجع العروض والمقترحات',
    description:
      'ارفع ملف العرض واحصل على تقييم واضح لنقاط القوة والضعف والعناصر الناقصة قبل الإرسال.',
    href: '/coach/proposal-review',
    icon: FileText,
    badge: 'PDF / DOCX / TXT',
    bullets: ['درجة جاهزية', 'ملاحظات تخصيص للعميل', 'افتتاحية محسنة للعرض'],
    accent:
      'border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#fffaf2_100%)]',
  },
  {
    title: 'مكالمات صوتية تدريبية',
    description:
      'مكالمات تدريب مباشرة داخل المتصفح مع عميل عربي له رحلة مبيعات مستمرة بين مكالمة وأخرى.',
    href: '/coach/voice-practice',
    icon: Waves,
    badge: 'Voice AI',
    bullets: ['رحلة عميل مستمرة', 'لهجات عربية متعددة', 'مراحل بيع متدرجة'],
    accent:
      'border-emerald-200 bg-[radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f3fff9_100%)]',
  },
  {
    title: 'تحليل المكالمات المسجلة',
    description:
      'ارفع مكالمة مبيعات مسجلة ليتم تفريغها وتحليلها وإعطاؤك مراجعة واضحة قابلة للتنفيذ.',
    href: '/coach/call-analysis',
    icon: Headphones,
    badge: 'تحليل بعد المكالمة',
    bullets: ['تفريغ نصي', 'تقييم ونصائح', 'سجل مراجعات سابق'],
    accent:
      'border-violet-200 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f7f7ff_100%)]',
  },
];

export default function CoachPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-card">
        <div className="bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
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
                    مركز تدريب المبيعات الذكي
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600">
                    اختر أداة التدريب المناسبة للمرحلة التي تريد تحسينها: بدء التواصل، مراجعة
                    عرض، مكالمة صوتية، أو تحليل مكالمة مسجلة. كل أداة الآن لها صفحة مستقلة حتى
                    يكون الوصول أسرع والتركيز أوضح.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                  أدوات مستقلة
                </span>
                <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                  تدريب نصي وصوتي
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  مراجعات قبل وبعد التواصل
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {coachTools.map(({ title, description, href, icon: Icon, badge, bullets, accent }) => (
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

              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg transition group-hover:scale-105">
                <Icon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-2xl border border-white/70 bg-white/80 p-4 text-xs font-semibold leading-6 text-slate-700 shadow-sm"
                >
                  {bullet}
                </div>
              ))}
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
