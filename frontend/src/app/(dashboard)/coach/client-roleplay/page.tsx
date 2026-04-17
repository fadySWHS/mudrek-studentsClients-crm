import { Sparkles } from 'lucide-react';
import CoachToolPage from '@/components/coach/CoachToolPage';
import ClientRoleplaySection from '@/components/coach/ClientRoleplaySection';

export default function ClientRoleplayPage() {
  return (
    <CoachToolPage
      icon={Sparkles}
      title="محاكاة عميل مباشر"
      description="عميل عربي جديد في كل مرة لتتدرب على بدء التواصل، اكتشاف الاحتياج، تقديم القيمة، والتعامل مع الاعتراضات داخل محادثة حية."
      eyebrow="Live Text Practice"
    >
      <ClientRoleplaySection />
    </CoachToolPage>
  );
}
