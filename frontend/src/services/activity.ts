import api from './api';

export interface ActivityEntry {
  id: string;
  leadId: string;
  lead: { id: string; name: string };
  actorId: string;
  actor: { id: string; name: string };
  actionType: string;
  fromValue?: string;
  toValue?: string;
  createdAt: string;
}

export interface ActivityResponse {
  history: ActivityEntry[];
  total: number;
  page: number;
}

export const activityService = {
  getLog: async (params?: {
    leadId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<ActivityResponse> => {
    const res = await api.get('/activity', { params });
    return res.data.data;
  },
};
