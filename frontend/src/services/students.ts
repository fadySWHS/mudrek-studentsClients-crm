import api from './api';

export interface Student {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'STUDENT';
  active: boolean;
  sourceStudentId?: string;
  createdAt: string;
}

export const studentsService = {
  getAll: async (): Promise<Student[]> => {
    const res = await api.get('/users');
    return res.data.data;
  },

  create: async (data: { name: string; email: string; password: string; role?: string }): Promise<Student> => {
    const res = await api.post('/users', data);
    return res.data.data;
  },

  update: async (id: string, data: Partial<Student>): Promise<Student> => {
    const res = await api.put(`/users/${id}`, data);
    return res.data.data;
  },

  toggleActive: async (id: string): Promise<Student> => {
    const res = await api.patch(`/users/${id}/toggle`);
    return res.data.data;
  },

  syncFromSheets: async (): Promise<{ created: number; updated: number }> => {
    const res = await api.post('/integrations/sync');
    return res.data.data;
  },
};
