'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/utils/auth';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import {
  Bot,
  Building2,
  CheckCircle2,
  History,
  Loader2,
  Mic,
  PhoneCall,
  PhoneOff,
  Sparkles,
  Target,
  TriangleAlert,
  UserRound,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

type VoiceCallStatus = 'idle' | 'connecting' | 'live' | 'ending';

interface VoiceCallReview {
  overallScore: number;
  summary: string;
  strengths: string[];
  misses: string[];
  discoveredFacts: string[];
  nextAction: string;
  nextStage: string;
  outcome: 'ACTIVE' | 'WON' | 'LOST';
  historySummary: string;
}

interface VoiceCallRecord {
  id: string;
  stage: string;
  stageLabel: string;
  status: string;
  score?: number;
  summary: string;
  durationSec: number;
  createdAt: string;
  startedAt: string;
  endedAt?: string;
  review?: VoiceCallReview | null;
}

interface VoiceJourney {
  id: string;
  clientName: string;
  clientRole: string;
  businessName: string;
  industry: string;
  location: string;
  dialect: string;
  stage: string;
  stageLabel: string;
  status: 'ACTIVE' | 'WON' | 'LOST' | 'ARCHIVED';
  publicBrief: string;
  historySummary: string;
  discoveredFacts: string[];
  currentObjectives: string[];
  createdAt: string;
  updatedAt: string;
  calls: VoiceCallRecord[];
}

interface VoiceTranscriptSegment {
  speaker: 'student' | 'client';
  text: string;
}

const toneClasses = {
  neutral: 'bg-slate-100 text-slate-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
};

const journeyStatusLabel = {
  ACTIVE: 'نشطة',
  WON: 'تم الإغلاق',
  LOST: 'متعثرة',
  ARCHIVED: 'مؤرشفة',
};

const parseErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
};

export default function VoicePracticeSection() {
  const { isAdmin, isStudent } = useAuth();
  const [journeys, setJourneys] = useState<VoiceJourney[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [loadingJourneys, setLoadingJourneys] = useState(true);
  const [creatingJourney, setCreatingJourney] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [checkingVoiceAvailability, setCheckingVoiceAvailability] = useState(true);
  const [callStatus, setCallStatus] = useState<VoiceCallStatus>('idle');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<VoiceTranscriptSegment[]>([]);
  const [callSeconds, setCallSeconds] = useState(0);
  const [lastReview, setLastReview] = useState<VoiceCallReview | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const seenTranscriptKeysRef = useRef<Set<string>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const selectedJourney = journeys.find((journey) => journey.id === selectedJourneyId) || null;
  const voiceLocked = !voiceEnabled;
  const createJourneyDisabled = creatingJourney || callStatus !== 'idle' || voiceLocked;
  const startCallDisabled = !selectedJourney || callStatus !== 'idle' || selectedJourney.status !== 'ACTIVE' || voiceLocked;

  const fetchVoiceAvailability = async () => {
    setCheckingVoiceAvailability(true);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/voice-availability`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل التحقق من جاهزية المكالمات الصوتية'));
      }

      const data = await res.json();
      setVoiceEnabled(Boolean(data.success && data.data?.enabled));
    } catch (e: any) {
      setVoiceEnabled(false);
      toast.error(e.message || 'تعذر التحقق من جاهزية المكالمات الصوتية');
    } finally {
      setCheckingVoiceAvailability(false);
    }
  };

  const fetchJourneys = async () => {
    setLoadingJourneys(true);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/voice-journeys`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل جلب رحلات التدريب الصوتي'));
      }

      const data = await res.json();
      const nextJourneys: VoiceJourney[] = data.success ? data.data || [] : [];
      setJourneys(nextJourneys);

      if (nextJourneys.length && !selectedJourneyId) {
        setSelectedJourneyId(nextJourneys[0].id);
      }
      if (!nextJourneys.length) {
        setSelectedJourneyId(null);
      }
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء جلب الرحلات');
    } finally {
      setLoadingJourneys(false);
    }
  };

  useEffect(() => {
    fetchVoiceAvailability();
    fetchJourneys();
  }, []);

  useEffect(() => {
    if (selectedJourneyId && !journeys.some((journey) => journey.id === selectedJourneyId)) {
      setSelectedJourneyId(journeys[0]?.id || null);
    }
  }, [journeys, selectedJourneyId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptSegments, callStatus]);

  useEffect(() => {
    if (callStatus !== 'live') {
      setCallSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      if (startedAtRef.current) {
        setCallSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    return () => {
      teardownConnection();
    };
  }, []);

  const teardownConnection = () => {
    dataChannelRef.current?.close();
    peerConnectionRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    remoteAudioRef.current = null;
  };

  const upsertJourney = (nextJourney: VoiceJourney) => {
    setJourneys((prev) => {
      const existing = prev.find((journey) => journey.id === nextJourney.id);
      if (!existing) return [nextJourney, ...prev];
      return prev.map((journey) => (journey.id === nextJourney.id ? nextJourney : journey));
    });
    setSelectedJourneyId(nextJourney.id);
  };

  const appendTranscript = (speaker: 'student' | 'client', text: string, key: string) => {
    const trimmed = text.trim();
    if (!trimmed || seenTranscriptKeysRef.current.has(key)) return;

    seenTranscriptKeysRef.current.add(key);
    setTranscriptSegments((prev) => [...prev, { speaker, text: trimmed }]);
  };

  const handleRealtimeEvent = (raw: string) => {
    try {
      const event = JSON.parse(raw);
      const eventKey = event.event_id || event.item_id || JSON.stringify(event).slice(0, 120);

      if (event.type === 'conversation.item.input_audio_transcription.completed') {
        appendTranscript(
          'student',
          event.transcript || event.item?.content?.[0]?.transcript || '',
          `student:${eventKey}`
        );
        return;
      }

      if (
        event.type === 'response.audio_transcript.done'
        || event.type === 'response.output_audio_transcript.done'
        || event.type === 'response.output_text.done'
      ) {
        appendTranscript(
          'client',
          event.transcript || event.text || event.delta || event.item?.content?.[0]?.transcript || '',
          `client:${eventKey}`
        );
        return;
      }

      if (event.type === 'error' && event.error?.message) {
        toast.error(event.error.message);
      }
    } catch {
      // Ignore non-JSON frames
    }
  };

  const createJourney = async () => {
    if (createJourneyDisabled) return;
    setCreatingJourney(true);
    setLastReview(null);

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/voice-journeys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل إنشاء عميل صوتي جديد'));
      }

      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error('لم تصل بيانات رحلة صوتية صالحة');
      }

      upsertJourney(data.data);
      toast.success('تم إنشاء رحلة عميل صوتي جديدة');
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء إنشاء العميل الصوتي');
    } finally {
      setCreatingJourney(false);
    }
  };

  const startCall = async () => {
    if (startCallDisabled) return;

    setCallStatus('connecting');
    setTranscriptSegments([]);
    seenTranscriptKeysRef.current.clear();
    setLastReview(null);

    try {
      const token = getToken();
      const startRes = await fetch(`${API_URL}/ai/voice-journeys/${selectedJourney.id}/calls/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!startRes.ok) {
        throw new Error(await parseErrorMessage(startRes, 'فشل بدء المكالمة'));
      }

      const startData = await startRes.json();
      const callId = startData.data?.callId;
      if (!callId) {
        throw new Error('لم يصل معرّف مكالمة صالح');
      }

      setActiveCallId(callId);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudioRef.current = remoteAudio;

      peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
      };

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      const dataChannel = peerConnection.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (event) => handleRealtimeEvent(event.data);

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === 'failed') {
          toast.error('انقطع الاتصال الصوتي. جرّب إنهاء المكالمة وإعادة المحاولة.');
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpRes = await fetch(`${API_URL}/ai/voice-journeys/${selectedJourney.id}/calls/${callId}/session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp || '',
      });

      if (!sdpRes.ok) {
        throw new Error(await parseErrorMessage(sdpRes, 'فشل إنشاء جلسة الصوت'));
      }

      const answerSdp = await sdpRes.text();
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      startedAtRef.current = Date.now();
      setCallStatus('live');
      toast.success('بدأت المكالمة الصوتية. ابدأ الحديث الآن.');
    } catch (e: any) {
      teardownConnection();
      setActiveCallId(null);
      setCallStatus('idle');
      toast.error(e.message || 'حدث خطأ أثناء بدء المكالمة');
    }
  };

  const endCall = async () => {
    if (!selectedJourney || !activeCallId) {
      teardownConnection();
      setCallStatus('idle');
      return;
    }

    setCallStatus('ending');
    teardownConnection();

    const durationSec = startedAtRef.current
      ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
      : callSeconds;

    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/ai/voice-journeys/${selectedJourney.id}/calls/${activeCallId}/complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptSegments,
          durationSec,
        }),
      });

      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, 'فشل إنهاء المكالمة'));
      }

      const data = await res.json();
      if (!data.success || !data.data?.journey) {
        throw new Error('لم تصل نتيجة صالحة للمكالمة');
      }

      upsertJourney(data.data.journey);
      setLastReview((data.data.call?.review as VoiceCallReview | null) || null);
      toast.success('تم حفظ المكالمة وتحديث مرحلة العميل');
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء إنهاء المكالمة');
    } finally {
      setActiveCallId(null);
      startedAtRef.current = null;
      setCallSeconds(0);
      setCallStatus('idle');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PhoneCall className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">مكالمات صوتية مباشرة مع عميل AI</h2>
          <p className="text-sm text-gray-500">
            عميل صوتي عربي مستمر عبر عدة مراحل بيع: أول اتصال، اكتشاف، تأهيل، عرض، متابعة، ثم حسم.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">رحلات العملاء الصوتية</h3>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  كل رحلة تحفظ نفس العميل وتاريخ مكالماته حتى تتدرب على الخطوات المهنية تدريجياً.
                </p>
              </div>
              <button
                onClick={createJourney}
                disabled={createJourneyDisabled}
                className="btn-primary inline-flex items-center gap-2 whitespace-nowrap"
              >
                {creatingJourney || checkingVoiceAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                عميل صوتي جديد
              </button>
            </div>

            {voiceLocked && (
              <div className="mt-4 rounded-3xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                <p className="font-bold text-amber-900">المكالمات الصوتية غير مفعلة بعد.</p>
                <p className="mt-2 leading-7">
                  {isAdmin
                    ? 'أضف مفتاح OpenAI Realtime من صفحة الإعدادات حتى يتم تفعيل إنشاء العملاء الصوتيين والمكالمات المباشرة.'
                    : isStudent
                      ? 'هذه الميزة ستبقى معطلة للطلاب حتى يقوم المشرف بإضافة مفتاح OpenAI Realtime من الإعدادات.'
                      : 'يلزم إضافة مفتاح OpenAI Realtime لتشغيل هذه الميزة.'}
                </p>
                {isAdmin && (
                  <Link
                    href="/settings"
                    className="mt-3 inline-flex rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
                  >
                    افتح الإعدادات
                  </Link>
                )}
              </div>
            )}

            <div className="mt-4 space-y-3">
              {loadingJourneys ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : journeys.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                  لا توجد رحلات صوتية بعد. أنشئ أول عميل لتجربة المكالمات المباشرة.
                </div>
              ) : (
                journeys.map((journey) => {
                  const active = selectedJourneyId === journey.id;
                  return (
                    <button
                      key={journey.id}
                      onClick={() => {
                        setSelectedJourneyId(journey.id);
                        setLastReview(null);
                      }}
                      className={`w-full rounded-3xl border p-4 text-right transition ${
                        active
                          ? 'border-primary/40 bg-primary/5 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{journey.clientName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {journey.clientRole} - {journey.businessName}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {journeyStatusLabel[journey.status]}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                          {journey.stageLabel}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {journey.dialect}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selectedJourney && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card">
              <div className="rounded-3xl bg-slate-900 p-5 text-white">
                <p className="text-xs font-semibold text-sky-200">العميل الحالي</p>
                <h3 className="mt-2 text-2xl font-bold">{selectedJourney.clientName}</h3>
                <p className="mt-1 text-sm text-slate-200">
                  {selectedJourney.clientRole} - {selectedJourney.businessName}
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {selectedJourney.industry} - {selectedJourney.location}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">المرحلة الحالية</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{selectedJourney.stageLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs text-slate-500">اللهجة</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{selectedJourney.dialect}</p>
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50/60 p-5">
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 className="h-4 w-4 text-primary" />
                  <h4 className="font-bold">المتاح لك حالياً</h4>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{selectedJourney.publicBrief}</p>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 text-slate-900">
                  <Target className="h-4 w-4 text-primary" />
                  <h4 className="font-bold">أهداف هذه المكالمة</h4>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedJourney.currentObjectives.map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {selectedJourney.discoveredFacts.length > 0 && (
                <div className="mt-4 rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
                  <p className="text-sm font-bold text-slate-900">معلومات مكتشفة حتى الآن</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedJourney.discoveredFacts.map((item) => (
                      <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedJourney.historySummary && (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <History className="h-4 w-4 text-primary" />
                    <h4 className="font-bold">آخر خلاصة مع هذا العميل</h4>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{selectedJourney.historySummary}</p>
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-900">لوحة المكالمة المباشرة</h3>
                <p className="mt-1 text-sm text-slate-500">
                  استخدم الميكروفون، وابدأ الحديث كأنها مكالمة مبيعات فعلية. العميل يرد بصوته حسب المرحلة الحالية فقط.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {selectedJourney?.stageLabel || 'اختر رحلة'}
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    callStatus === 'live'
                      ? 'bg-emerald-100 text-emerald-700'
                      : callStatus === 'connecting'
                        ? 'bg-sky-100 text-sky-700'
                        : callStatus === 'ending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {callStatus === 'live'
                    ? `مكالمة مباشرة • ${callSeconds}s`
                    : callStatus === 'connecting'
                      ? 'جارٍ الاتصال'
                      : callStatus === 'ending'
                        ? 'جارٍ حفظ المكالمة'
                        : 'جاهز للبدء'}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={startCall}
                disabled={startCallDisabled}
                className="btn-primary inline-flex items-center gap-2"
              >
                {callStatus === 'connecting' || checkingVoiceAvailability ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="h-4 w-4" />
                )}
                ابدأ المكالمة
              </button>

              <button
                onClick={endCall}
                disabled={callStatus !== 'live' && callStatus !== 'connecting'}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
              >
                {callStatus === 'ending' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneOff className="h-4 w-4" />
                )}
                إنهاء المكالمة
              </button>
            </div>

            <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-sm text-slate-600">
              <p className="font-bold text-slate-900">طريقة الاستخدام</p>
              <p className="mt-2 leading-7">
                هذه ليست مكالمة هاتفية حقيقية. هي جلسة صوتية داخل المتصفح. ابدأ أنت بالكلام بعد الاتصال، والعميل سيجيبك باللهجة المحددة
                مع الحفاظ على تاريخ الرحلة والمعلومات المكتشفة سابقاً.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 p-5">
              <h3 className="font-bold text-slate-900">النص الحي للمكالمة</h3>
              <p className="mt-1 text-sm text-slate-500">
                سيتم تجميع النصوص المستخرجة من المكالمة هنا ثم استخدامها لتقييم الأداء وتحديد المرحلة التالية.
              </p>
            </div>

            <div className="max-h-[420px] min-h-[320px] space-y-4 overflow-y-auto bg-slate-50/60 p-4">
              {!transcriptSegments.length ? (
                <div className="flex h-[260px] flex-col items-center justify-center text-center text-sm text-slate-500">
                  <Mic className="mb-3 h-8 w-8 text-slate-300" />
                  <p>ابدأ مكالمة جديدة، ثم تحدّث مع العميل ليظهر النص الحي هنا.</p>
                </div>
              ) : (
                transcriptSegments.map((segment, index) => (
                  <div
                    key={`${segment.speaker}-${index}`}
                    className={`flex max-w-[88%] gap-3 ${
                      segment.speaker === 'student' ? 'mr-auto flex-row-reverse' : 'ml-auto'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${
                        segment.speaker === 'student' ? 'bg-primary text-white' : 'bg-slate-900 text-white'
                      }`}
                    >
                      {segment.speaker === 'student' ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div
                      className={`rounded-3xl border px-4 py-3 text-sm leading-7 shadow-sm ${
                        segment.speaker === 'student'
                          ? 'rounded-tr-md border-primary bg-primary text-white'
                          : 'rounded-tl-md border-slate-200 bg-white text-slate-800'
                      }`}
                    >
                      {segment.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {(lastReview || selectedJourney?.calls.length) && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">مراجعة آخر مكالمة</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    يتم تحديث المرحلة حسب جودة الحوار وما تم اكتشافه أو حسمه داخل المكالمة.
                  </p>
                </div>
                {(lastReview || selectedJourney?.calls[0]?.review) && (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5 text-lg font-bold text-primary">
                    {(lastReview || selectedJourney?.calls[0]?.review)?.overallScore}
                  </div>
                )}
              </div>

              {(lastReview || selectedJourney?.calls[0]?.review) && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-3xl bg-slate-900 p-5 text-white">
                    <p className="text-sm leading-7">
                      {(lastReview || selectedJourney?.calls[0]?.review)?.summary}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {(lastReview || selectedJourney?.calls[0]?.review)?.strengths?.length ? (
                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-slate-900">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <h4 className="font-bold">ما تم بشكل جيد</h4>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(lastReview || selectedJourney?.calls[0]?.review)?.strengths.map((item) => (
                            <span key={item} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClasses.neutral}`}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {(lastReview || selectedJourney?.calls[0]?.review)?.misses?.length ? (
                      <div className="rounded-3xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-slate-900">
                          <TriangleAlert className="h-4 w-4 text-primary" />
                          <h4 className="font-bold">ما يحتاج تحسين</h4>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(lastReview || selectedJourney?.calls[0]?.review)?.misses.map((item) => (
                            <span key={item} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${toneClasses.warning}`}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {(lastReview || selectedJourney?.calls[0]?.review)?.nextAction && (
                    <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
                      <p className="text-sm font-bold text-slate-900">أفضل خطوة تالية</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {(lastReview || selectedJourney?.calls[0]?.review)?.nextAction}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
