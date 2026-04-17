import { FileText } from 'lucide-react';
import CoachToolPage from '@/components/coach/CoachToolPage';
import ProposalReviewSection from '@/components/coach/ProposalReviewSection';

export default function ProposalReviewPage() {
  return (
    <CoachToolPage
      icon={FileText}
      title="مراجع العروض والمقترحات"
      description="ارفع ملف المقترح التجاري وأضف ما تعرفه عن العميل ليعطيك الذكاء مراجعة عملية قبل الإرسال، مع درجة واضحة وملاحظات قابلة للتنفيذ."
      eyebrow="Proposal Review"
    >
      <ProposalReviewSection />
    </CoachToolPage>
  );
}
