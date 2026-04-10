'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/utils/auth';
import toast from 'react-hot-toast';
import { Mic, UploadCloud, FileAudio, CheckCircle2, ChevronDown, ChevronUp, Bot, Sparkles, Loader2 } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Analysis {
  id: string;
  score: number;
  transcript: string;
  feedback: string;
  createdAt: string;
  student?: { name: string };
}

export default function CoachPage() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Live Stream State
  const [liveStatus, setLiveStatus] = useState<string>('');
  const [liveFeedback, setLiveFeedback] = useState<string>('');
  const [parsedTranscript, setParsedTranscript] = useState<string>('');

  const fetchHistory = async () => {
    try {
      const token = getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/ai/analyze-call`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      
      console.log('Starting fetch to API...');
      const res = await fetch(`${apiUrl}/ai/analyze-call`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      console.log('Fetch resolved with status:', res.status);
      
      if (!res.ok) {
        // Read the error message if backend sent one
        let errMsg = `Server Error: ${res.status}`;
        try {
           const errData = await res.clone().json();
           if (errData.message || errData.error) errMsg = errData.message || errData.error;
        } catch(e) {}
        throw new Error(errMsg);
      }
      
      if (!res.body) throw new Error('لا يوجد تجاوب من الخادم');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        console.log('Stream chunk received. Done?', done, 'Byte length:', value?.byteLength);
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
              if (data.text) setLiveFeedback(prev => prev + data.text);
              if (data.status === 'done' && data.data) {
                toast.success('تم التقييم بنجاح!');
                setHistory(prev => [data.data, ...prev]);
                setSelectedFile(null);
                setExpandedId(data.data.id);
              }
            } catch (e) {
               console.warn('Failed to parse SSE JSON chunk', e);
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900">مركز تدريب المبيعات الذكي</h1>
          <p className="text-sm text-gray-500 mt-1">
            ارفع مكالماتك المسجلة مع العملاء هنا وسيقوم الذكاء الاصطناعي بتحليل أدائك وإعطائك نسبة إغلاق ونصائح للتحسين.
          </p>
        </div>
      </div>

      <div className="card p-6 border-dashed border-2 border-primary/20 bg-primary/5">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          {selectedFile ? (
            <div className="flex flex-col items-center">
              <FileAudio className="w-12 h-12 text-primary mb-3" />
              <p className="text-sm font-bold text-gray-800">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              
              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setSelectedFile(null)} 
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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

              {/* LIVE TERMINAL UI */}
              {isUploading && (
                <div className="w-full mt-8 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl text-right flex flex-col">
                  {/* Terminal Header */}
                  <div className="bg-gray-800/80 px-4 py-3 flex items-center border-b border-gray-700">
                    <div className="flex gap-2 mr-auto">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300 text-xs font-mono">
                      <Loader2 className="w-3 h-3 animate-spin text-primary-light" />
                      {liveStatus === 'uploading' && 'جاري رفع الملف إلى الخادم...'}
                      {liveStatus === 'transcribing' && 'جاري تحويل الصوت إلى نص...'}
                      {liveStatus === 'analyzing' && 'يتم تحليل استراتيجيات البيع...'}
                      {liveStatus === 'typing' && 'جاري صياغة التقييم النهائي...'}
                      {liveStatus === 'done' && 'اكتمل التقييم!'}
                    </div>
                  </div>
                  
                  {/* Terminal Body */}
                  <div className="p-5 text-gray-300 font-mono text-sm leading-relaxed max-h-80 overflow-y-auto text-right text-balance">
                    {parsedTranscript && liveStatus === 'analyzing' && (
                      <div className="mb-4 text-gray-500 border-b border-gray-800 pb-4">
                        <span className="text-green-400 block mb-2">&gt; تم استخراج النص بنجاح:</span>
                        {parsedTranscript.substring(0, 150)}...
                      </div>
                    )}
                    
                    {liveFeedback ? (
                      <div className="whitespace-pre-wrap text-emerald-400">
                        {liveFeedback}
                        <span className="inline-block w-2 h-4 ml-1 bg-emerald-400 animate-pulse"></span>
                      </div>
                    ) : liveStatus === 'transcribing' || liveStatus === 'analyzing' ? (
                      <div className="text-gray-500 flex flex-col gap-2">
                        <p className="animate-pulse">&gt; يتم الآن الاستماع للمكالمة ومعالجة الصوتيات...</p>
                        <p className="opacity-50">الرجاء الانتظار، قد يستغرق هذا بضع ثوانٍ بناءً على طول المكالمة.</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <UploadCloud className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">اختر أو اسحب ملف المكالمة هنا</h3>
              <p className="text-xs text-gray-500 mb-6 max-w-sm">
                الامتدادات المدعومة: MP3, WAV, M4A. سيتم حذف الملف تلقائياً فور انتهاء التحليل لحفظ المساحة وخصوصية العميل.
              </p>
              
              <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
                <Mic className="w-4 h-4" />
                تحديد ملف
                <input 
                  type="file" 
                  accept="audio/mp3,audio/wav,audio/m4a,audio/x-m4a,audio/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />
              </label>
            </>
          )}
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mt-8 mb-4">سجل التدريب والتقييمات</h2>
      
      {loadingHistory ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">
          لم تقم برفع أي مكالمات حتى الآن.
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record) => {
            const isExpanded = expandedId === record.id;
            return (
              <div key={record.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm transition-all hover:shadow-md">
                {/* Header (Click to expand) */}
                <div 
                  className="p-5 cursor-pointer flex items-center justify-between"
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center border-4 font-bold text-lg ${getScoreColor(record.score)}`}>
                      {record.score}
                    </div>
                    <div>
                      {record.student && (
                        <p className="text-xs font-semibold text-primary mb-1">المتدرب: {record.student.name}</p>
                      )}
                      <p className="font-bold text-gray-800">تحليل مكالمة مبيعات</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(record.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${getScoreBarColor(record.score)}`} style={{ width: `${record.score}%` }} />
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50 space-y-6">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        نصائح وتوجيهات المدير الآلي (Feedback)
                      </h4>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap shadow-sm">
                        {record.feedback}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-gray-900 mb-3 text-sm text-gray-500">
                        التفريغ النصي للمكالمة (Transcript)
                      </h4>
                      <div className="bg-white p-4 rounded-xl border border-gray-100 text-xs text-gray-600 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
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
    </div>
  );
}
