'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@/utils/auth';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Loader2,
  Mic,
  Sparkles,
  UploadCloud,
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

export default function CallAnalysisSection() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>('');
  const [liveFeedback, setLiveFeedback] = useState<string>('');
  const [parsedTranscript, setParsedTranscript] = useState<string>('');

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
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let eventBoundary = buffer.indexOf('\n\n');
        while (eventBoundary !== -1) {
          const eventStr = buffer.slice(0, eventBoundary);
          buffer = buffer.slice(eventBoundary + 2);

          if (eventStr.startsWith('data: ')) {
            const dataStr = eventStr.slice(6);
            if (dataStr === '[DONE]') {
              streamDone = true;
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                toast.error(data.error);
                streamDone = true;
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
              // Ignore malformed stream chunks and keep processing the rest.
            }
          }

          eventBoundary = buffer.indexOf('\n\n');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ غير متوقع');
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

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">تحليل المكالمات المسجلة</h2>
              <p className="text-sm text-gray-500">
                ارفع التسجيل ليتم تفريغه وتحليله وتقييمه كنقاط قوة وضعف وفرص تحسين.
              </p>
            </div>
          </div>

          <div className="card mt-6 border-2 border-dashed border-primary/20 bg-primary/5 p-6">
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
                      <Sparkles className="h-4 w-4" />
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
                              الرجاء الانتظار، قد يستغرق هذا بضع الثواني حسب طول المكالمة.
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
                    <Mic className="h-4 w-4" />
                    تحديد ملف
                    <input
                      type="file"
                      accept="audio/mp3,audio/wav,audio/m4a,audio/x-m4a,audio/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                  </label>
                </>
              )}
            </div>
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
                        <div className="whitespace-pre-wrap rounded-xl border border-gray-100 bg-white p-4 text-sm leading-relaxed text-gray-700 shadow-sm">
                          {record.feedback}
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-3 text-sm font-bold text-gray-500">
                          التفريغ النصي للمكالمة
                        </h4>
                        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-100 bg-white p-4 text-xs leading-relaxed text-gray-600">
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
