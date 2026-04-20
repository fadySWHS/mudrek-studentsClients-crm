'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAi } from '@/context/AiContext';
import { aiService, LeadAssistantMessage } from '@/services/ai';
import { X, Send, Bot, User, Loader2, Sparkles, FileText, MessageSquareText, Repeat, Target, Wallet, ClipboardList } from 'lucide-react';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

interface Message extends LeadAssistantMessage {}

interface StarterAction {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: typeof FileText;
}

const makeTempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function AiSidebar() {
  const { isOpen, setIsOpen, leadContext, draftPrompt, setDraftPrompt } = useAi();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const starterActions = useMemo<StarterAction[]>(() => {
    const serviceHint = leadContext?.service || 'الخدمة المناسبة';
    const clientName = leadContext?.name || 'هذا العميل';

    return [
      {
        id: 'proposal',
        title: 'إنشاء عرض عمل',
        description: 'صياغة عرض مختصر ومقنع جاهز للإرسال.',
        prompt: `أنشئ عرض عمل مختصرًا ومقنعًا للعميل ${clientName} بناءً على بياناته الحالية، مع هيكل واضح، قيمة مقترحة، وخطوة تالية مناسبة.`,
        icon: FileText,
      },
      {
        id: 'outreach',
        title: 'كتابة رسالة تواصل',
        description: 'رسالة واتساب أو تواصل أولي بأسلوب مهني.',
        prompt: `اكتب رسالة تواصل أولى قصيرة ومهنية لهذا العميل ${clientName} للترويج لخدمة ${serviceHint}، وتكون مناسبة للإرسال عبر واتساب.`,
        icon: MessageSquareText,
      },
      {
        id: 'follow-up',
        title: 'رسالة متابعة',
        description: 'متابعة ذكية إذا لم يرد العميل بعد.',
        prompt: `اكتب 3 صيغ متابعة ذكية وقصيرة للعميل ${clientName} إذا لم يرد بعد، مع تنويع بسيط بين الرسمية والودودة والمباشرة.`,
        icon: Repeat,
      },
      {
        id: 'objection',
        title: 'رد على اعتراض السعر',
        description: 'رد عملي ومقنع بدون مبالغة.',
        prompt: `اكتب ردًا مقنعًا ومهنيًا على اعتراض السعر للعميل ${clientName}، مع الحفاظ على قيمة الخدمة وعدم الظهور بمظهر الدفاع.`,
        icon: Wallet,
      },
      {
        id: 'discovery',
        title: 'أسئلة اكتشاف',
        description: 'أسئلة ذكية للمكالمة القادمة مع العميل.',
        prompt: `جهز لي قائمة بأسئلة اكتشاف ذكية ومباشرة للمكالمة القادمة مع العميل ${clientName} حتى أفهم احتياجه الحقيقي، الميزانية، التوقيت، وصاحب القرار.`,
        icon: ClipboardList,
      },
      {
        id: 'closing',
        title: 'خطة إغلاق',
        description: 'أفضل زاوية بيع وخطوات الإغلاق التالية.',
        prompt: `حلل وضع العميل ${clientName} واقترح أفضل زاوية بيع وخطة إغلاق عملية من 3 إلى 5 خطوات بناءً على بياناته الحالية.`,
        icon: Target,
      },
    ];
  }, [leadContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isLoadingHistory]);

  useEffect(() => {
    if (isOpen && draftPrompt) {
      setInput(draftPrompt);
      setDraftPrompt('');
    }
  }, [isOpen, draftPrompt, setDraftPrompt]);

  useEffect(() => {
    if (!isOpen) return;

    if (!leadContext?.id) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadConversation = async () => {
      setIsLoadingHistory(true);
      setMessages([]);
      try {
        const conversation = await aiService.getLeadConversation(leadContext.id);
        if (!cancelled) {
          setMessages(conversation.messages);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || 'فشل تحميل محادثة العميل');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadConversation();
    return () => {
      cancelled = true;
    };
  }, [isOpen, leadContext?.id]);

  const handleSubmit = async (textToSubmit: string = input) => {
    const normalizedMessage = textToSubmit.trim();
    if (!normalizedMessage || isLoading || !leadContext?.id) return;

    const userMessage: Message = {
      id: makeTempId('user'),
      role: 'user',
      content: normalizedMessage,
      createdAt: new Date().toISOString(),
    };

    const assistantPlaceholderId = makeTempId('assistant');
    const assistantPlaceholder: Message = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setIsLoading(true);

    try {
      const finalReply = await aiService.streamLeadConversation({
        leadId: leadContext.id,
        message: normalizedMessage,
        model: 'openai/gpt-4o-mini',
        onText: (streamedText) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantPlaceholderId
                ? { ...message, content: streamedText }
                : message
            )
          );
        },
      });

      if (!finalReply.trim()) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantPlaceholderId
              ? { ...message, content: 'لم يصل رد واضح من المساعد. جرّب إعادة الصياغة أو اختر إجراءً محددًا.' }
              : message
          )
        );
      }
    } catch (err: any) {
      const fallbackMessage = err.message || 'تعذر إكمال الرد هذه المرة.';
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantPlaceholderId
            ? { ...message, content: `❌ ${fallbackMessage}` }
            : message
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden"
        onClick={() => setIsOpen(false)}
      />
      <div
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 flex w-[95%] transform flex-col border-r border-gray-200 bg-white shadow-2xl transition-transform duration-300 sm:w-[430px]',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-b border-gray-100 bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="leading-tight font-bold text-gray-900">Client AI Assistant</h3>
                {leadContext ? (
                  <p className="text-xs font-medium text-primary">
                    {leadContext.name}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">Open from a client page</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {leadContext && (
            <div className="mt-3 flex flex-wrap gap-2">
              {leadContext.service && (
                <span className="rounded-full bg-white px-3 py-1 text-[11px] text-gray-600 shadow-sm">
                  الخدمة: {leadContext.service}
                </span>
              )}
              {leadContext.budget && (
                <span className="rounded-full bg-white px-3 py-1 text-[11px] text-gray-600 shadow-sm">
                  الميزانية: {leadContext.budget}
                </span>
              )}
              {leadContext.status && (
                <span className="rounded-full bg-white px-3 py-1 text-[11px] text-gray-600 shadow-sm">
                  الحالة: {leadContext.status}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoadingHistory ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <div>
                <p className="text-sm font-semibold text-gray-900">جاري تحميل محادثة العميل</p>
                <p className="mt-1 text-xs text-gray-500">سيتم استرجاع آخر الرسائل المحفوظة لهذا العميل.</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/10 bg-primary/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">ابدأ بإجراء مفيد بدل رسالة فارغة</p>
                    <p className="mt-1 text-xs leading-6 text-gray-600">
                      المحادثة لهذا العميل سيتم حفظها، ويمكنك البدء مباشرة من أحد الاقتراحات التالية.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {starterActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleSubmit(action.prompt)}
                      disabled={isLoading || !leadContext?.id}
                      className="group rounded-2xl border border-gray-200 bg-white p-4 text-right transition-all hover:border-primary/30 hover:bg-primary/[0.03]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-surface text-primary transition-colors group-hover:bg-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                          <p className="mt-1 text-xs leading-6 text-gray-500">{action.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex max-w-[88%] gap-3',
                    message.role === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                      message.role === 'user' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div
                    className={cn(
                      'rounded-2xl p-3 text-sm leading-relaxed whitespace-pre-wrap',
                      message.role === 'user'
                        ? 'rounded-tr-sm bg-primary text-white'
                        : 'rounded-tl-sm border border-gray-100 bg-gray-50 text-gray-800'
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="ml-auto flex max-w-[88%] gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-gray-100 bg-gray-50 p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-gray-500">يكتب الرد...</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-100 bg-white p-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-1.5 transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
            <div className="flex items-end gap-2">
              <textarea
                className="min-h-[44px] max-h-32 flex-1 resize-none border-none bg-transparent px-3 py-3 text-sm focus:ring-0"
                placeholder={
                  leadContext
                    ? 'اكتب طلبك هنا أو اختر أحد الاقتراحات بالأعلى...'
                    : 'افتح المساعد من داخل صفحة عميل أولًا'
                }
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                rows={1}
                disabled={!leadContext?.id || isLoadingHistory}
              />
              <button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isLoading || !leadContext?.id || isLoadingHistory}
                className="flex-shrink-0 rounded-lg bg-primary p-3 text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 text-center text-[10px] text-gray-400">
            يتم حفظ المحادثة لكل عميل على حدة. راجع الرد قبل الإرسال للعميل.
          </div>
        </div>
      </div>
    </>
  );
}
