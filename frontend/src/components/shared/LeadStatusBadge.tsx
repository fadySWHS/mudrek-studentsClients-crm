import { LeadStatus } from '@/services/leads';
import { leadStatusLabels, leadStatusBadgeClass } from '@/utils/leadStatus';

export default function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={leadStatusBadgeClass[status]}>
      {leadStatusLabels[status]}
    </span>
  );
}
