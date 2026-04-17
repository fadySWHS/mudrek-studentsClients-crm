import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, LucideIcon } from 'lucide-react';

interface CoachToolPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
}

export default function CoachToolPage({
  icon: Icon,
  title,
  description,
  eyebrow = 'أداة تدريب مستقلة',
  children,
}: CoachToolPageProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Link
                href="/coach"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-primary/20 hover:text-primary"
              >
                <ChevronRight className="h-4 w-4" />
                العودة إلى صفحة أدوات التدريب
              </Link>

              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                    {eyebrow}
                  </p>
                  <h1 className="text-3xl font-bold font-heading text-slate-900">{title}</h1>
                  <p className="max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
