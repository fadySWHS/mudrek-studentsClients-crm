type LeadContactLike = {
  phone?: string | null;
  contactInfoLocked?: boolean;
};

export const LOCKED_LEAD_CONTACT_LABEL = '••••••••••';
export const LOCKED_LEAD_CONTACT_HINT = 'احجز العميل لإظهار بيانات التواصل';
export const EMPTY_LEAD_CONTACT_LABEL = '—';

export const getLeadContactLabel = (lead: LeadContactLike) => {
  if (lead.contactInfoLocked) {
    return LOCKED_LEAD_CONTACT_LABEL;
  }

  return lead.phone || EMPTY_LEAD_CONTACT_LABEL;
};
