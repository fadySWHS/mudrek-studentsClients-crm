'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/utils/auth';
import toast from 'react-hot-toast';
import {
  Bot,
  Building2,
  Loader2,
  MessageSquareQuote,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface PracticeSession {
  sessionId: string;
  scenarioType: 'inbound' | 'outbound';
  outreachChannel: string;
  leadTemperature: string;
  firstContactHint: string;
  discoveryTargets: string[];
  clientName: string;
  clientRole: string;
  businessName: string;
  industry: string;
  location: string;
  businessSummary: string;
  companySize: string;
  digitalMaturity: string;
  targetService: string;
  mainNeed: string;
  budgetRange: string;
  urgency: string;
  personality: string;
  communicationStyle: string;
  openingMood: string;
  difficulty: string;
  goals: string[];
  painPoints: string[];
  objections: string[];
  hiddenContext: string[];
  openingMessage: string;
}

interface PracticeMessage {
  role: 'assistant' | 'user';
  content: string;
}

const toneClasses = {
  neutral: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
};

const scenarioTypeLabels = {
  inbound: 'العميل بدأ التواصل',
  outbound: 'أنت تبدأ الرسالة الأولى',
};

const parseErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

export default function ClientRoleplaySection() {
  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [practiceMessages, setPracticeMessages] = useState<PracticeMessage[]>([]);
  const [practiceInput, setPracticeInput] = useState('');
  const [isGeneratingSession, setIsGeneratingSession] = useState(false);
  const [isPracticeSending, setIsPracticeSending] = useState(false);
  const practiceMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    practiceMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [practiceMessages, isPracticeSending]);

  const createPracticeSession = async () => {
    if (isGeneratingSession) return;

    setIsGeneratingSession(true);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/practice-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل إنشاء العميل التدريبي'));
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error('لم تصل بيانات الجلسة بشكل صحيح');
      }

      const nextSession: PracticeSession = data.data;
      setPracticeSession(nextSession);
      setPracticeMessages(
        nextSession.openingMessage
          ? [{ role: 'assistant', content: nextSession.openingMessage }]
          : []
      );
      setPracticeInput('');
      toast.success('تم إنشاء عميل جديد للتدريب');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء إنشاء الجلسة');
    } finally {
      setIsGeneratingSession(false);
    }
  };

  const handlePracticeSubmit = async () => {
    if (!practiceSession || !practiceInput.trim() || isPracticeSending) return;

    const userMessage: PracticeMessage = {
      role: 'user',
      content: practiceInput.trim(),
    };
    const nextMessages = [...practiceMessages, userMessage];

    setPracticeMessages(nextMessages);
    setPracticeInput('');
    setIsPracticeSending(true);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/practice-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: practiceSession.sessionId,
          messages: nextMessages,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل الرد من العميل التدريبي'));
      }

      const data = await res.json();
      if (!data.success || !data.data?.reply) {
        throw new Error('لم يصل رد صالح من العميل');
      }

      setPracticeMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.data.reply },
      ]);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setIsPracticeSending(false);
    }
  };

  const isOutboundScenario = practiceSession?.scenarioType === 'outbound';

  const scenarioBlocks =
    practiceSession && !isOutboundScenario
      ? [
          {
            title: 'الأهداف الحالية',
            items: practiceSession.goals,
            tone: 'neutral' as const,
            icon: Target,
          },
          {
            title: 'الاعتراضات المتوقعة',
            items: practiceSession.objections,
            tone: 'warning' as const,
            icon: TriangleAlert,
          },
          {
            title: 'نقاط الألم',
            items: practiceSession.painPoints,
            tone: 'danger' as const,
            icon: MessageSquareQuote,
          },
        ]
      : [];

  return (
    <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-card">
      <div className="border-b border-sky-100 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.15),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900">محاكاة عميل مباشر</h2>
              <p className="max-w-2xl text-sm leading-7 text-gray-600">
                كل جلسة تعطيك شخصية عميل جديدة تماماً: نشاط مختلف، طريقة كلام مختلفة، اعتراضات
                مختلفة، واحتياج رقمي جديد. بعضها يبدأ من العميل، وبعضها يجعلك أنت تبدأ التواصل.
              </p>
            </div>
          </div>

          <button
            onClick={createPracticeSession}
            disabled={isGeneratingSession}
            className="btn-primary inline-flex min-w-[190px] items-center justify-center gap-2"
          >
            {isGeneratingSession ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : practiceSession ? (
              <RefreshCcw className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {practiceSession ? 'عميل جديد' : 'ابدأ جلسة جديدة'}
          </button>
        </div>
      </div>

      {practiceSession ? (
        <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="border-b border-slate-100 bg-slate-50/70 p-5 lg:border-b-0 lg:border-l">
            <div className="space-y-5">
              <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-lg">
                <p className="text-xs font-semibold text-sky-200">العميل الحالي</p>
                <h3 className="mt-2 text-2xl font-bold">{practiceSession.clientName}</h3>
                <p className="mt-1 text-sm text-slate-200">
                  {practiceSession.clientRole} - {practiceSession.businessName}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {practiceSession.industry} - {practiceSession.location}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">نوع السيناريو</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                    {scenarioTypeLabels[practiceSession.scenarioType]}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">قناة التواصل</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                    {practiceSession.outreachChannel}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">
                    {isOutboundScenario ? 'حجم النشاط' : 'الخدمة المرجحة'}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                    {isOutboundScenario
                      ? practiceSession.companySize
                      : practiceSession.targetService}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">
                    {isOutboundScenario ? 'الحضور الرقمي الحالي' : 'حرارة العميل'}
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">
                    {isOutboundScenario
                      ? practiceSession.digitalMaturity
                      : practiceSession.leadTemperature}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h4 className="font-bold">
                    {isOutboundScenario ? 'المتاح لك حالياً عن العميل' : 'ملخص النشاط'}
                  </h4>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {isOutboundScenario
                    ? 'هذه معلومات أولية فقط. لا تعتمد على افتراضاتك، وابدأ بجمع الاحتياج الحقيقي أثناء الحوار.'
                    : practiceSession.businessSummary}
                </p>
                <div className="mt-4 space-y-2 text-sm leading-7 text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">النشاط:</span>{' '}
                    {practiceSession.businessName}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">الدور:</span>{' '}
                    {practiceSession.clientRole}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">المجال والمدينة:</span>{' '}
                    {practiceSession.industry} - {practiceSession.location}
                  </p>
                  {!isOutboundScenario && (
                    <>
                      <p>
                        <span className="font-semibold text-slate-800">الاحتياج الرئيسي:</span>{' '}
                        {practiceSession.mainNeed}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">أسلوب الشخصية:</span>{' '}
                        {practiceSession.personality}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">طريقة التواصل:</span>{' '}
                        {practiceSession.communicationStyle}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">الحجم الحالي:</span>{' '}
                        {practiceSession.companySize} - {practiceSession.digitalMaturity}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">الميزانية والاستعجال:</span>{' '}
                        {practiceSession.budgetRange} - {practiceSession.urgency}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {isOutboundScenario && (
                <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5 shadow-sm">
                  <p className="text-sm font-bold text-slate-900">كيف تبدأ الوصول الأول؟</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {practiceSession.firstContactHint}
                  </p>
                </div>
              )}

              {isOutboundScenario && practiceSession.discoveryTargets.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="font-bold">ما الذي يجب أن تكتشفه؟</h4>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {practiceSession.discoveryTargets.map((item) => (
                      <span
                        key={item}
                        className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {scenarioBlocks.map(({ title, items, tone, icon: Icon }) => (
                <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="font-bold">{title}</h4>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${toneClasses[tone]}`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {!isOutboundScenario && practiceSession.hiddenContext.length > 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-100/70 p-5">
                  <p className="text-sm font-bold text-slate-900">خلفية إضافية</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    {practiceSession.hiddenContext.map((item) => (
                      <p key={item}>• {item}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-[640px] flex-col">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-900">محادثة المحاكاة</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isOutboundScenario
                    ? 'في هذه الجلسة أنت من يبدأ التواصل. افتتح الحديث بذكاء ثم قدّم القيمة وتعامل مع الردود كفرصة حقيقية.'
                    : 'الذكاء هنا يلعب دور العميل فقط. مهمتك أن تبيع، تستكشف، تعالج الاعتراضات، وتقود المحادثة كأنها فرصة حقيقية.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                  <MessageSquareQuote className="h-4 w-4" />
                  {scenarioTypeLabels[practiceSession.scenarioType]}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                  {isOutboundScenario ? 'معلومات أولية محدودة' : practiceSession.openingMood}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4">
              {isOutboundScenario && practiceMessages.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-600 shadow-sm">
                  <p className="font-bold text-slate-900">هذه جلسة outbound.</p>
                  <p className="mt-2 leading-7">
                    العميل لم يبدأ الحديث بعد. استخدم معلوماته وقناة التواصل المقترحة، ثم اكتب أنت
                    الرسالة الأولى.
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    تلميح البداية: {practiceSession.firstContactHint}
                  </p>
                </div>
              )}

              {practiceMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex max-w-[88%] gap-3 ${
                    message.role === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
                      message.role === 'user' ? 'bg-primary text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <UserRound className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  <div
                    className={`rounded-3xl border px-4 py-3 text-sm leading-7 shadow-sm ${
                      message.role === 'user'
                        ? 'rounded-tr-md border-primary bg-primary text-white'
                        : 'rounded-tl-md border-slate-200 bg-white text-slate-800'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isPracticeSending && (
                <div className="ml-auto flex max-w-[88%] gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-3xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    العميل يفكر في رده...
                  </div>
                </div>
              )}

              <div ref={practiceMessagesEndRef} />
            </div>

            <div className="border-t border-slate-100 bg-white p-4">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                <textarea
                  value={practiceInput}
                  onChange={(event) => setPracticeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handlePracticeSubmit();
                    }
                  }}
                  placeholder={
                    isOutboundScenario
                      ? 'ابدأ برسالة outreach الأولى لهذا العميل...'
                      : 'اكتب رسالتك كأنك مندوب المبيعات أو مزود الخدمة...'
                  }
                  className="min-h-[130px] w-full resize-none border-none bg-transparent px-4 py-4 text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400"
                />

                <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    {isOutboundScenario
                      ? 'ابدأ بتخصيص الرسالة على النشاط والاحتياج، ثم قدّم سبباً مقنعاً للرد بدون إطالة.'
                      : 'حاول أن تبدأ بالاكتشاف، ثم اربط المشكلة بالخدمة، ثم عالج الاعتراض بدون ضغط.'}
                  </p>

                  <button
                    onClick={handlePracticeSubmit}
                    disabled={!practiceInput.trim() || isPracticeSending}
                    className="btn-primary inline-flex items-center justify-center gap-2"
                  >
                    {isPracticeSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    إرسال الرسالة
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <p className="text-sm font-bold text-slate-900">ماذا ستحصل عليه في كل جلسة؟</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">هوية عميل كاملة</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  اسم، وظيفة، نشاط، مدينة، حجم العمل، ومستوى حضوره الرقمي.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">شخصية وسلوك مختلفان</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  عميل سريع، متردد، متشكك، تحليلي، أو حساس للسعر حسب الجلسة.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">اعتراضات واقعية</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  السعر، الثقة، التوقيت، النتائج، التجارب السابقة، أو مقارنة بمنافسين.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">محادثة حية</p>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  الذكاء يرد كعميل حقيقي، وأنت تتدرب على البيع وتقديم الخدمة في نفس الوقت.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-sm">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-slate-900">جاهز لأول عميل؟</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              ابدأ الآن وسيقوم الذكاء بتوليد سيناريو جديد بالكامل لتتدرب عليه من الصفر.
            </p>
            <button
              onClick={createPracticeSession}
              disabled={isGeneratingSession}
              className="btn-primary mt-6 inline-flex items-center gap-2"
            >
              {isGeneratingSession ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              توليد عميل تدريبي
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
