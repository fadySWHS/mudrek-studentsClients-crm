import type { LeadStatus } from '@/services/leads';

export const leadStatusLabels: Record<LeadStatus, string> = {
  AVAILABLE: 'متاح',
  TAKEN: 'محجوز',
  CONTACTED: 'تم التواصل',
  FOLLOW_UP: 'متابعة',
  QUALIFIED: 'مؤهل',
  CLOSED_WON: 'مغلق - ناجح',
  CLOSED_LOST: 'مغلق - خسارة',
};

export const leadStatusBadgeClass: Record<LeadStatus, string> = {
  AVAILABLE: 'badge-available',
  TAKEN: 'badge-taken',
  CONTACTED: 'badge-contacted',
  FOLLOW_UP: 'badge-follow_up',
  QUALIFIED: 'badge-qualified',
  CLOSED_WON: 'badge-closed_won',
  CLOSED_LOST: 'badge-closed_lost',
};
