import { Waves } from 'lucide-react';
import CoachToolPage from '@/components/coach/CoachToolPage';
import VoicePracticeSection from '@/components/coach/VoicePracticeSection';

export default function VoicePracticePage() {
  return (
    <CoachToolPage
      icon={Waves}
      title="مكالمات صوتية تدريبية"
      description="تدريب مكالمات حي داخل المتصفح مع عميل عربي له تاريخ ورحلة بيع متدرجة بين المكالمات، من أول تواصل حتى العرض والمتابعة."
      eyebrow="Voice Journey"
    >
      <VoicePracticeSection />
    </CoachToolPage>
  );
}
