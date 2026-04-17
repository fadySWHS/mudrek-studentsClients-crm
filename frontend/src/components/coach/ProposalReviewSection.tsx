'use client';

import { useState } from 'react';
import { getToken } from '@/utils/auth';
import toast from 'react-hot-toast';
import {
  Building2,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Target,
  TriangleAlert,
  UploadCloud,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface ProposalClientContext {
  clientName: string;
  businessName: string;
  industry: string;
  contactRole: string;
  offeredService: string;
  proposalStage: string;
  budgetLevel: string;
  urgencyLevel: string;
  mainGoal: string;
  knownObjections: string;
  specialNotes: string;
}

interface ProposalReview {
  overallScore: number;
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  missingItems: string[];
  riskFlags: string[];
  clientFitObservations: string[];
  rewriteSuggestions: string[];
  nextStepAdvice: string;
  improvedOpening: string;
}

const toneClasses = {
  neutral: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
};

const emptyProposalContext: ProposalClientContext = {
  clientName: '',
  businessName: '',
  industry: '',
  contactRole: '',
  offeredService: '',
  proposalStage: '',
  budgetLevel: '',
  urgencyLevel: '',
  mainGoal: '',
  knownObjections: '',
  specialNotes: '',
};

const proposalIndustryOptions = [
  'عيادة أسنان',
  'مكتب عقارات',
  'براند ملابس',
  'مطعم أو كافيه',
  'مركز تجميل',
  'أكاديمية تدريب',
  'شركة خدمات محلية',
  'متجر إلكتروني',
];

const proposalRoleOptions = [
  'صاحب النشاط',
  'مدير تسويق',
  'مدير مبيعات',
  'مدير تشغيل',
  'شريك',
  'مسؤول تطوير أعمال',
];

const proposalServiceOptions = [
  'إدارة السوشيال ميديا',
  'إعلانات ممولة',
  'تصميم موقع أو متجر',
  'هوية بصرية وبراندنج',
  'SEO وخرائط Google',
  'إعداد CRM أو أتمتة',
  'كتابة محتوى وتصوير',
];

const proposalStageOptions = [
  'أول عرض بعد التواصل الأول',
  'بعد مكالمة اكتشاف',
  'بعد اجتماع عرض',
  'عرض متابعة بعد نقاش سابق',
  'عرض نهائي تجاري',
];

const proposalBudgetOptions = [
  'غير معروف',
  'محدود',
  'متوسط',
  'مرن إذا كانت القيمة واضحة',
  'مرتفع نسبياً',
];

const proposalUrgencyOptions = ['غير معروف', 'منخفض', 'متوسط', 'مرتفع', 'عاجل جداً'];

const parseErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

export default function ProposalReviewSection() {
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [proposalContext, setProposalContext] = useState<ProposalClientContext>(emptyProposalContext);
  const [proposalReview, setProposalReview] = useState<ProposalReview | null>(null);
  const [proposalMeta, setProposalMeta] = useState<{
    fileName: string;
    extractedChars: number;
    truncated: boolean;
    contextUsed: boolean;
  } | null>(null);
  const [isReviewingProposal, setIsReviewingProposal] = useState(false);

  const hasProposalContext = Object.values(proposalContext).some((value) => value.trim());

  const proposalReviewBlocks = proposalReview
    ? [
        {
          title: 'نقاط القوة',
          items: proposalReview.strengths,
          tone: 'neutral' as const,
          icon: CheckCircle2,
        },
        {
          title: 'نقاط الضعف',
          items: proposalReview.weaknesses,
          tone: 'warning' as const,
          icon: TriangleAlert,
        },
        {
          title: 'أشياء ناقصة',
          items: proposalReview.missingItems,
          tone: 'danger' as const,
          icon: Target,
        },
        {
          title: 'ملاءمة العرض للعميل',
          items: proposalReview.clientFitObservations,
          tone: 'neutral' as const,
          icon: Building2,
        },
        {
          title: 'مخاطر قبل الإرسال',
          items: proposalReview.riskFlags,
          tone: 'warning' as const,
          icon: TriangleAlert,
        },
        {
          title: 'اقتراحات التحسين',
          items: proposalReview.rewriteSuggestions,
          tone: 'neutral' as const,
          icon: Sparkles,
        },
      ].filter((block) => block.items.length > 0)
    : [];

  const handleProposalContextChange = (field: keyof ProposalClientContext, value: string) => {
    setProposalContext((prev) => ({ ...prev, [field]: value }));
  };

  const handleProposalReview = async () => {
    if (!proposalFile || isReviewingProposal) return;

    const formData = new FormData();
    formData.append('proposal', proposalFile);
    Object.entries(proposalContext).forEach(([key, value]) => {
      if (value.trim()) formData.append(key, value.trim());
    });

    setIsReviewingProposal(true);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/review-proposal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل مراجعة العرض'));
      }

      const data = await res.json();
      if (!data.success || !data.data?.review) {
        throw new Error('لم يصل تقييم صالح للعرض');
      }

      setProposalReview(data.data.review);
      setProposalMeta({
        fileName: data.data.fileName,
        extractedChars: data.data.extractedChars,
        truncated: data.data.truncated,
        contextUsed: data.data.contextUsed,
      });
      toast.success('تمت مراجعة العرض بنجاح');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء مراجعة العرض');
    } finally {
      setIsReviewingProposal(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">ملف العرض</h2>
                <p className="mt-1 text-xs text-slate-500">
                  الصيغ المدعومة: PDF, DOC, DOCX, TXT. الأفضل استخدام PDF أو DOCX واضح النص.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                خطوة 1
              </div>
            </div>

            <div className="mt-4 rounded-3xl border-2 border-dashed border-primary/20 bg-primary/5 p-5 text-center">
              {proposalFile ? (
                <div className="flex flex-col items-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-900">{proposalFile.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(proposalFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>

                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        setProposalFile(null);
                        setProposalReview(null);
                        setProposalMeta(null);
                      }}
                      disabled={isReviewingProposal}
                      className="rounded-xl px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleProposalReview}
                      disabled={isReviewingProposal}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {isReviewingProposal ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      مراجعة العرض
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
                    <UploadCloud className="h-8 w-8 text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-slate-900">اختر ملف العرض أو المقترح</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    سيتم استخراج النص ثم مراجعته من ناحية الإقناع، التخصيص، وضوح القيمة،
                    والخطوة التالية.
                  </p>
                  <label className="btn-primary mt-5 inline-flex cursor-pointer items-center gap-2">
                    <FileText className="h-4 w-4" />
                    تحديد ملف
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          setProposalFile(file);
                          setProposalReview(null);
                          setProposalMeta(null);
                        }
                      }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">معلومات العميل</h3>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                    اختيارية لكن مفضلة
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  أدخل فقط ما تعرفه. كل معلومة هنا تجعل المراجعة أكثر دقة وتخصيصاً.
                </p>
              </div>
              {hasProposalContext && (
                <button
                  onClick={() => setProposalContext(emptyProposalContext)}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  مسح البيانات
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">اسم العميل</span>
                <input
                  value={proposalContext.clientName}
                  onChange={(event) =>
                    handleProposalContextChange('clientName', event.target.value)
                  }
                  placeholder="مثال: أحمد حسن"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">اسم النشاط</span>
                <input
                  value={proposalContext.businessName}
                  onChange={(event) =>
                    handleProposalContextChange('businessName', event.target.value)
                  }
                  placeholder="مثال: عيادات الابتسامة"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">المجال</span>
                <select
                  value={proposalContext.industry}
                  onChange={(event) =>
                    handleProposalContextChange('industry', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">غير محدد</option>
                  {proposalIndustryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">جهة التواصل</span>
                <select
                  value={proposalContext.contactRole}
                  onChange={(event) =>
                    handleProposalContextChange('contactRole', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">غير محدد</option>
                  {proposalRoleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">الخدمة المعروضة</span>
                <select
                  value={proposalContext.offeredService}
                  onChange={(event) =>
                    handleProposalContextChange('offeredService', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">غير محدد</option>
                  {proposalServiceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">مرحلة العرض</span>
                <select
                  value={proposalContext.proposalStage}
                  onChange={(event) =>
                    handleProposalContextChange('proposalStage', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">غير محدد</option>
                  {proposalStageOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">الميزانية</span>
                <select
                  value={proposalContext.budgetLevel}
                  onChange={(event) =>
                    handleProposalContextChange('budgetLevel', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">غير محدد</option>
                  {proposalBudgetOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-slate-600">الاستعجال</span>
                <select
                  value={proposalContext.urgencyLevel}
                  onChange={(event) =>
                    handleProposalContextChange('urgencyLevel', event.target.value)
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="">غير محدد</option>
                  {proposalUrgencyOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-600">الهدف الرئيسي للعميل</span>
                <input
                  value={proposalContext.mainGoal}
                  onChange={(event) =>
                    handleProposalContextChange('mainGoal', event.target.value)
                  }
                  placeholder="مثال: زيادة الحجوزات أو رفع المبيعات أو بناء حضور أقوى"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-600">اعتراضات أو تحفظات معروفة</span>
                <input
                  value={proposalContext.knownObjections}
                  onChange={(event) =>
                    handleProposalContextChange('knownObjections', event.target.value)
                  }
                  placeholder="مثال: السعر، الخوف من النتائج، التوقيت"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-xs font-semibold text-slate-600">ملاحظات إضافية</span>
                <textarea
                  value={proposalContext.specialNotes}
                  onChange={(event) =>
                    handleProposalContextChange('specialNotes', event.target.value)
                  }
                  placeholder="أي تفاصيل تعرفها عن العميل أو الظروف الحالية أو ما سبق من نقاش"
                  className="min-h-[110px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card">
          {proposalReview ? (
            <div className="space-y-5">
              <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-sky-200">نتيجة مراجعة العرض</p>
                    <h3 className="text-xl font-bold">جاهزية المقترح قبل الإرسال</h3>
                    <p className="text-sm leading-7 text-slate-200">
                      {proposalReview.executiveSummary}
                    </p>
                  </div>
                  <div
                    className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-4 bg-white text-lg font-bold ${getScoreColor(proposalReview.overallScore)}`}
                  >
                    {proposalReview.overallScore}
                  </div>
                </div>
              </div>

              {proposalMeta && (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    الملف: {proposalMeta.fileName}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    النص المستخرج: {proposalMeta.extractedChars.toLocaleString('ar-EG')} حرف
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {proposalMeta.contextUsed
                      ? 'تم استخدام معلومات العميل'
                      : 'المراجعة اعتمدت على الملف فقط'}
                  </span>
                  {proposalMeta.truncated && (
                    <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                      تمت مراجعة جزء كبير من الملف حتى حد آمن
                    </span>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {proposalReviewBlocks.map(({ title, items, tone, icon: Icon }) => (
                  <div key={title} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Icon className="h-4 w-4 text-primary" />
                      <h4 className="font-bold">{title}</h4>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {items.map((item) => (
                        <span
                          key={`${title}-${item}`}
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${toneClasses[tone]}`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
                <p className="text-sm font-bold text-slate-900">أفضل خطوة تالية</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {proposalReview.nextStepAdvice}
                </p>
              </div>

              {proposalReview.improvedOpening && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold text-slate-900">افتتاحية مقترحة أقوى للعرض</p>
                  <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                    {proposalReview.improvedOpening}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">
                ارفع العرض لتحصل على مراجعة فورية
              </h3>
              <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
                ستحصل على درجة عامة، نقاط القوة والضعف، العناصر الناقصة، ملاحظات حول ملاءمة
                العرض للعميل، واقتراحات مباشرة لتحسين الصياغة قبل الإرسال.
              </p>
              <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">درجة واضحة</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    تعرف فوراً مدى جاهزية العرض الحالي.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">نواقص حرجة</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    تكتشف ما ينقص قبل أن يراه العميل.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">صياغة محسنة</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    تحصل على افتتاحية مقترحة أقوى وأكثر تخصيصاً.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
