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
    
    let message = 'حدث خطأ غير متوقع';
    if (err.response?.data?.message) {
      message = err.response.data.message;
    } else if (err.response) {
      const dataStr = typeof err.response.data === 'string' 
        ? err.response.data.substring(0, 100).replace(/\n/g, ' ') 
        : JSON.stringify(err.response.data).substring(0, 100);
      message = `[${err.response.status}] إجابة غير متوقعة من الخادم: ${dataStr}`;
    } else if (err.request) {
      message = `تعذر الوصول للخادم أو لا توجد استجابة: ${err.message}`;
    } else {
      message = err.message || 'حدث خطأ في الاتصال بالخادم';
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
