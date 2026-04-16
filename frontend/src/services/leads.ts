import api from './api';

export type LeadStatus =
  | 'AVAILABLE' | 'TAKEN' | 'CONTACTED'
  | 'FOLLOW_UP' | 'QUALIFIED' | 'CLOSED_WON' | 'CLOSED_LOST';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  service?: string;
  source?: string;
  budget?: string;
  status: LeadStatus;
  notes?: string;
  lostReason?: string;
  assignedToId?: string;
  assignedTo?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
}

export interface LeadClaimPolicy {
  canClaimNewLeads: boolean;
  reason: string | null;
  activeLeadCount: number;
  activeLeadReservationLimit: number | null;
  remainingClaims: number | null;
  hasSuccessfulDeal: boolean;
  blockNewLeadsAfterWon: boolean;
  defaultActiveLeadLimit: number;
  defaultBlockNewLeadsAfterWon: boolean;
  usesDefaultLimit: boolean;
  usesDefaultBlockAfterWon: boolean;
  isBlockedByLimit: boolean;
  isBlockedBySuccessfulDeal: boolean;
  overrides?: {
    leadReservationLimitOverride: number | null;
    blockNewLeadsAfterWonOverride: boolean | null;
  };
}

export const leadsService = {
  getAll: async (params?: {
    status?: string;
    assignedTo?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<LeadListResponse> => {
    const res = await api.get('/leads', { params });
    return res.data.data;
  },

  getOne: async (id: string): Promise<Lead & { comments: LeadComment[]; history: LeadHistory[]; reminders: Reminder[] }> => {
    const res = await api.get(`/leads/${id}`);
    return res.data.data;
  },

  create: async (data: Partial<Lead>): Promise<Lead> => {
    const res = await api.post('/leads', data);
    return res.data.data;
  },

  update: async (id: string, data: Partial<Lead>): Promise<Lead> => {
    const res = await api.put(`/leads/${id}`, data);
    return res.data.data;
  },

  claim: async (id: string): Promise<Lead> => {
    const res = await api.post(`/leads/${id}/claim`);
    return res.data.data;
  },

  getClaimPolicy: async (): Promise<LeadClaimPolicy> => {
    const res = await api.get('/leads/claim-policy');
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/leads/${id}`);
  },
};

export interface LeadComment {
  id: string;
  leadId: string;
  userId: string;
  user: { id: string; name: string };
  commentText: string;
  createdAt: string;
}

export interface LeadHistory {
  id: string;
  actionType: string;
  fromValue?: string;
  toValue?: string;
  actor: { id: string; name: string };
  createdAt: string;
}

export interface Reminder {
  id: string;
  leadId: string;
  dueAt: string;
  status: 'PENDING' | 'DONE' | 'OVERDUE';
  note?: string;
  createdAt: string;
}

export const commentsService = {
  add: async (leadId: string, commentText: string): Promise<LeadComment> => {
    const res = await api.post(`/leads/${leadId}/comments`, { commentText });
    return res.data.data;
  },
};

export const remindersService = {
  create: async (leadId: string, data: { dueAt: string; note?: string }): Promise<Reminder> => {
    const res = await api.post(`/leads/${leadId}/reminders`, data);
    return res.data.data;
  },

  getAll: async (): Promise<Reminder[]> => {
    const res = await api.get('/reminders');
    return res.data.data;
  },
};
