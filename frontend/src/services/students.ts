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

export interface UserListResponse {
  users: Student[];
  total: number;
  page: number;
  limit: number;
}

export const studentsService = {
  getAll: async (params?: { role?: 'ADMIN' | 'STUDENT'; page?: number; limit?: number; search?: string }): Promise<UserListResponse> => {
    const res = await api.get('/users', { params });
    return res.data.data;
  },

  create: async (data: { name: string; email: string; password: string; role?: string }): Promise<Student> => {
    const res = await api.post('/users', data);
    return res.data.data;
  },

  update: async (id: string, data: Partial<Student> & { password?: string }): Promise<Student> => {
    const res = await api.put(`/users/${id}`, data);
    return res.data.data;
  },

  bulkToggleActive: async (userIds: string[], active: boolean): Promise<void> => {
    await api.patch('/users/bulk/toggle-active', { userIds, active });
  },

  toggleActive: async (id: string): Promise<Student> => {
    const res = await api.patch(`/users/${id}/toggle-active`);
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  bulkDelete: async (userIds: string[]): Promise<void> => {
    await api.post('/users/bulk/delete', { userIds });
  },

  syncFromSheets: async (): Promise<{ created: number; updated: number; disabled: number }> => {
    const res = await api.post('/integrations/sync-students');
    return res.data.data;
  },
};
