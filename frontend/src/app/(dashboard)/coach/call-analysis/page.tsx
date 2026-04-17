import { Headphones } from 'lucide-react';
import CoachToolPage from '@/components/coach/CoachToolPage';
import CallAnalysisSection from '@/components/coach/CallAnalysisSection';

export default function CallAnalysisPage() {
  return (
    <CoachToolPage
      icon={Headphones}
      title="تحليل المكالمات المسجلة"
      description="ارفع مكالمة مبيعات مسجلة ليتم تفريغها وتحليلها وإعطاؤك تقييم واضح ونقاط تحسين، مع سجل مراجعات سابق يمكن الرجوع له."
      eyebrow="Post-Call Analysis"
    >
      <CallAnalysisSection />
    </CoachToolPage>
  );
}
