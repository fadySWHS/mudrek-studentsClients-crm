import api from './api';

export interface DashboardStats {
  leads: {
    total: number;
    available: number;
    active: number;
    closedWon: number;
    closedLost: number;
  };
  students: { total: number; active: number };
  overdueReminders: number;
}

export interface StudentPerformance {
  id: string;
  name: string;
  total: number;
  closedWon: number;
  closedLost: number;
  active: number;
}

export const reportsService = {
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await api.get('/reports/dashboard');
    return res.data.data;
  },

  getStudentPerformance: async (): Promise<StudentPerformance[]> => {
    const res = await api.get('/reports/students');
    return res.data.data;
  },

  getLostReasons: async (): Promise<Record<string, number>> => {
    const res = await api.get('/reports/lost-reasons');
    return res.data.data;
  },
};
