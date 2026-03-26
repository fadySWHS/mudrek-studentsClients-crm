import api from './api';
import { AuthUser } from '@/utils/auth';

export const authService = {
  login: async (email: string, password: string): Promise<{ token: string; user: AuthUser }> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data.data;
  },

  me: async (): Promise<AuthUser> => {
    const res = await api.get('/auth/me');
    return res.data.data;
  },
};
