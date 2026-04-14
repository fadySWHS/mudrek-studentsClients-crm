'use client';

import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/utils/auth';
import toast from 'react-hot-toast';
import {
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Loader2,
  MessageSquareQuote,
  Mic,
  RefreshCcw,
  Send,
  Sparkles,
  Target,
  TriangleAlert,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface Analysis {
  id: string;
  score: number;
  transcript: string;
  feedback: string;
  createdAt: string;
  student?: { name: string };
}

interface PracticeSession {
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

const statusLabels: Record<string, string> = {
  uploading: 'جاري رفع الملف إلى الخادم...',
  transcribing: 'جاري تحويل الصوت إلى نص...',
  analyzing: 'يتم تحليل استراتيجيات البيع...',
  typing: 'جاري صياغة التقييم النهائي...',
  done: 'اكتمل التقييم.',
};

const parseErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

const toneClasses = {
  neutral: 'bg-slate-100 text-slate-700',
  danger: 'bg-rose-100 text-rose-700',
  warning: 'bg-amber-100 text-amber-700',
};

export default function CoachPage() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [liveStatus, setLiveStatus] = useState<string>('');
  const [liveFeedback, setLiveFeedback] = useState<string>('');
  const [parsedTranscript, setParsedTranscript] = useState<string>('');

  const [practiceSession, setPracticeSession] = useState<PracticeSession | null>(null);
  const [practiceMessages, setPracticeMessages] = useState<PracticeMessage[]>([]);
  const [practiceInput, setPracticeInput] = useState('');
  const [isGeneratingSession, setIsGeneratingSession] = useState(false);
  const [isPracticeSending, setIsPracticeSending] = useState(false);

  const practiceMessagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/analyze-call`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch {
      toast.error('حدث خطأ في جلب سجل التدريب');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

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
        throw new Error(await parseErrorMessage(res, 'فشل إنشاء العميل التجريبي'));
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error('لم تصل بيانات الجلسة بشكل صحيح');
      }

      const nextSession: PracticeSession = data.data;
      setPracticeSession(nextSession);
      setPracticeMessages([{ role: 'assistant', content: nextSession.openingMessage }]);
      setPracticeInput('');
      toast.success('تم إنشاء عميل جديد للتدريب');
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء إنشاء الجلسة');
    } finally {
      setIsGeneratingSession(false);
    }
  };

  const handlePracticeSubmit = async () => {
    if (!practiceSession || !practiceInput.trim() || isPracticeSending) return;

    const token = getToken();
    const userMessage: PracticeMessage = {
      role: 'user',
      content: practiceInput.trim(),
    };
    const nextMessages = [...practiceMessages, userMessage];

    setPracticeMessages(nextMessages);
    setPracticeInput('');
    setIsPracticeSending(true);

    try {
      const res = await fetch(`${API_URL}/ai/practice-chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: practiceSession,
          messages: nextMessages,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل الرد من العميل التجريبي'));
      }

      const data = await res.json();
      if (!data.success || !data.data?.reply) {
        throw new Error('لم يصل رد صالح من العميل');
      }

      setPracticeMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.data.reply },
      ]);
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setIsPracticeSending(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('audio', selectedFile);

    setIsUploading(true);
    setLiveStatus('uploading');
    setLiveFeedback('');
    setParsedTranscript('');

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/analyze-call`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, `Server Error: ${res.status}`));
      }

      if (!res.body) {
        throw new Error('لا يوجد تجاوب من الخادم');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let eventBoundary = buffer.indexOf('\n\n');
        while (eventBoundary !== -1) {
          const eventStr = buffer.slice(0, eventBoundary);
          buffer = buffer.slice(eventBoundary + 2);

          if (eventStr.startsWith('data: ')) {
            const dataStr = eventStr.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                toast.error(data.error);
                break;
              }
              if (data.status) setLiveStatus(data.status);
              if (data.transcript) setParsedTranscript(data.transcript);
              if (data.text) setLiveFeedback((prev) => prev + data.text);
              if (data.status === 'done' && data.data) {
                toast.success('تم التقييم بنجاح');
                setHistory((prev) => [data.data, ...prev]);
                setSelectedFile(null);
                setExpandedId(data.data.id);
              }
            } catch {
            }
          }

          eventBoundary = buffer.indexOf('\n\n');
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsUploading(false);
      setLiveStatus('');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 85) return 'bg-green-500';
    if (score >= 65) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const scenarioBlocks = practiceSession
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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
          <Bot className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-heading text-gray-900">مركز تدريب المبيعات الذكي</h1>
          <p className="text-sm text-gray-500 max-w-3xl leading-7">
            درّب نفسك بطريقتين: حاكي عميلاً حقيقياً مختلفاً في كل جلسة، أو ارفع مكالمة
            مسجلة ليحلل الذكاء أداءك ويعطيك ملاحظات واضحة قابلة للتنفيذ.
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-card">
        <div className="border-b border-sky-100 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.15),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.12),_transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-gray-900">محاكاة عميل مباشر</h2>
                <p className="text-sm text-gray-600 max-w-2xl leading-7">
                  كل ضغطة تنشئ شخصية جديدة بالكامل: اسم مختلف، نشاط مختلف، طريقة كلام مختلفة،
                  اعتراضات مختلفة، واحتياج رقمي جديد حتى تتدرب وكأنك تتعامل مع عميل فعلي.
                </p>
              </div>
            </div>

            <button
              onClick={createPracticeSession}
              disabled={isGeneratingSession}
              className="btn-primary inline-flex items-center justify-center gap-2 min-w-[190px]"
            >
              {isGeneratingSession ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : practiceSession ? (
                <RefreshCcw className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
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
                    <p className="text-xs text-slate-500">الخدمة المرجحة</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800 leading-6">
                      {practiceSession.targetService}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">الميزانية</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800 leading-6">
                      {practiceSession.budgetRange}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">درجة الصعوبة</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800 leading-6">
                      {practiceSession.difficulty}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs text-slate-500">الاستعجال</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800 leading-6">
                      {practiceSession.urgency}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-900">
                    <Building2 className="w-4 h-4 text-primary" />
                    <h4 className="font-bold">ملخص النشاط</h4>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 leading-7">
                    {practiceSession.businessSummary}
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
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
                  </div>
                </div>

                {scenarioBlocks.map(({ title, items, tone, icon: Icon }) => (
                  <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Icon className="w-4 h-4 text-primary" />
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

                {practiceSession.hiddenContext.length > 0 && (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-100/70 p-5">
                    <p className="text-sm font-bold text-slate-900">خلفية إضافية</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600 leading-6">
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
                    الذكاء هنا يلعب دور العميل فقط. مهمتك أن تبيع، تستكشف، تعالج الاعتراضات،
                    وتقود المحادثة كأنها فرصة حقيقية.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                  <MessageSquareQuote className="w-4 h-4" />
                  {practiceSession.openingMood}
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4">
                {practiceMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex max-w-[88%] gap-3 ${
                      message.role === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-primary text-white'
                          : 'bg-slate-900 text-white'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <UserRound className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
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
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2 rounded-3xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      العميل يفكر في ردّه...
                    </div>
                  </div>
                )}

                <div ref={practiceMessagesEndRef} />
              </div>

              <div className="border-t border-slate-100 bg-white p-4">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                  <textarea
                    value={practiceInput}
                    onChange={(e) => setPracticeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handlePracticeSubmit();
                      }
                    }}
                    placeholder="اكتب رسالتك كأنك مندوب المبيعات أو مزود الخدمة..."
                    className="min-h-[130px] w-full resize-none border-none bg-transparent px-4 py-4 text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400"
                  />

                  <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      حاول أن تبدأ بالاكتشاف، ثم اربط المشكلة بالخدمة، ثم عالج الاعتراض بدون ضغط.
                    </p>

                    <button
                      onClick={handlePracticeSubmit}
                      disabled={!practiceInput.trim() || isPracticeSending}
                      className="btn-primary inline-flex items-center justify-center gap-2"
                    >
                      {isPracticeSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
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
              <p className="text-sm font-bold text-slate-900">ما الذي ستحصل عليه في كل جلسة؟</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">هوية عميل كاملة</p>
                  <p className="mt-2 text-xs text-slate-500 leading-6">
                    اسم، وظيفة، نشاط، مدينة، حجم العمل، ومستوى حضوره الرقمي.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">شخصية وسلوك مختلفان</p>
                  <p className="mt-2 text-xs text-slate-500 leading-6">
                    عميل سريع، متردد، متشكك، تحليلي، أو حساس للسعر حسب الجلسة.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">اعتراضات واقعية</p>
                  <p className="mt-2 text-xs text-slate-500 leading-6">
                    السعر، الثقة، التوقيت، النتائج، التجارب السابقة، أو المقارنة بمنافسين.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-800">محادثة حية</p>
                  <p className="mt-2 text-xs text-slate-500 leading-6">
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
              <p className="mt-2 text-sm text-slate-500 leading-7">
                ابدأ الآن وسيقوم الذكاء بتوليد سيناريو جديد بالكامل لتتدرب عليه من الصفر.
              </p>
              <button
                onClick={createPracticeSession}
                disabled={isGeneratingSession}
                className="btn-primary mt-6 inline-flex items-center gap-2"
              >
                {isGeneratingSession ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                توليد عميل تدريبي
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">تحليل المكالمات المسجلة</h2>
            <p className="text-sm text-gray-500">
              ارفع التسجيل ليتم تفريغه وتحليله وتقييمه كنقاط قوة وضعف وفرص تحسين.
            </p>
          </div>
        </div>

        <div className="card border-2 border-dashed border-primary/20 bg-primary/5 p-6">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            {selectedFile ? (
              <div className="flex w-full flex-col items-center">
                <FileAudio className="mb-3 h-12 w-12 text-primary" />
                <p className="text-sm font-bold text-gray-800">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="rounded-lg px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                    disabled={isUploading}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    بدء تحليل المكالمة
                  </button>
                </div>

                {isUploading && (
                  <div className="mt-8 flex w-full flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900 text-right shadow-2xl">
                    <div className="flex items-center border-b border-gray-700 bg-gray-800/80 px-4 py-3">
                      <div className="mr-auto flex gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs text-gray-300">
                        <Loader2 className="h-3 w-3 animate-spin text-primary-light" />
                        {statusLabels[liveStatus] || 'جاري المعالجة...'}
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto p-5 text-right font-mono text-sm leading-relaxed text-gray-300">
                      {parsedTranscript && liveStatus === 'analyzing' && (
                        <div className="mb-4 border-b border-gray-800 pb-4 text-gray-500">
                          <span className="mb-2 block text-green-400">
                            تم استخراج النص بنجاح:
                          </span>
                          {parsedTranscript.substring(0, 150)}...
                        </div>
                      )}

                      {liveFeedback ? (
                        <div className="whitespace-pre-wrap text-emerald-400">
                          {liveFeedback}
                          <span className="mr-1 inline-block h-4 w-2 animate-pulse bg-emerald-400" />
                        </div>
                      ) : liveStatus === 'transcribing' || liveStatus === 'analyzing' ? (
                        <div className="flex flex-col gap-2 text-gray-500">
                          <p className="animate-pulse">
                            يتم الآن الاستماع للمكالمة ومعالجة الصوتيات...
                          </p>
                          <p className="opacity-50">
                            الرجاء الانتظار، قد يستغرق هذا بعض الثواني حسب طول المكالمة.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 font-bold text-gray-800">اختر أو اسحب ملف المكالمة هنا</h3>
                <p className="mb-6 max-w-sm text-xs text-gray-500">
                  الامتدادات المدعومة: MP3, WAV, M4A. سيتم حذف الملف تلقائياً فور انتهاء
                  التحليل للحفاظ على المساحة وخصوصية العميل.
                </p>

                <label className="btn-primary inline-flex cursor-pointer items-center gap-2">
                  <Mic className="w-4 h-4" />
                  تحديد ملف
                  <input
                    type="file"
                    accept="audio/mp3,audio/wav,audio/m4a,audio/x-m4a,audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-800">سجل التدريب والتقييمات</h2>

        {loadingHistory ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-gray-500">
            لم تقم برفع أي مكالمات حتى الآن.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((record) => {
              const isExpanded = expandedId === record.id;

              return (
                <div
                  key={record.id}
                  className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md"
                >
                  <div
                    className="flex cursor-pointer items-center justify-between p-5"
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full border-4 text-lg font-bold ${getScoreColor(record.score)}`}
                      >
                        {record.score}
                      </div>
                      <div>
                        {record.student && (
                          <p className="mb-1 text-xs font-semibold text-primary">
                            المتدرب: {record.student.name}
                          </p>
                        )}
                        <p className="font-bold text-gray-800">تحليل مكالمة مبيعات</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(record.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden h-2 w-32 overflow-hidden rounded-full bg-gray-100 sm:block">
                        <div
                          className={`h-full ${getScoreBarColor(record.score)}`}
                          style={{ width: `${record.score}%` }}
                        />
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-6 border-t border-gray-100 bg-gray-50/50 p-5">
                      <div>
                        <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          نصائح وتوجيهات المدرب الآلي
                        </h4>
                        <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm leading-relaxed text-gray-700 shadow-sm whitespace-pre-wrap">
                          {record.feedback}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3 text-sm font-bold text-gray-500">
                          التفريغ النصي للمكالمة
                        </h4>
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-white p-4 text-xs leading-relaxed text-gray-600 whitespace-pre-wrap">
                          {record.transcript}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
