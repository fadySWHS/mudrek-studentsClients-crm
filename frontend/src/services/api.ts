import axios from 'axios';
import { getToken, removeToken } from '@/utils/auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      removeToken();
      window.location.href = '/login';
    }
    const message = err.response?.data?.message || 'حدث خطأ في الاتصال بالخادم';
    return Promise.reject(new Error(message));
  }
);

export default api;
