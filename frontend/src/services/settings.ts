import api from './api';

export interface SystemSetting {
  key: string;
  label: string;
  description?: string;
  sensitive: boolean;
  hasValue: boolean;
  value: string;       // masked with '••••••••' for sensitive keys that are set
  updatedAt: string;
}

export const settingsService = {
  getAll: async (): Promise<SystemSetting[]> => {
    const res = await api.get('/settings');
    return res.data.data;
  },

  update: async (key: string, value: string): Promise<void> => {
    await api.put(`/settings/${key}`, { value });
  },

  testTwochat: async (): Promise<string> => {
    const res = await api.post('/settings/test/twochat');
    return res.data.message;
  },

  testSheets: async (): Promise<{ headers: string[] }> => {
    const res = await api.post('/settings/test/sheets');
    return res.data.data;
  },

  testWebhook: async (): Promise<string> => {
    const res = await api.post('/settings/test/webhook');
    return res.data.message;
  },
};
