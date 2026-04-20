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
      const rawData = typeof err.response.data === 'string'
        ? err.response.data
        : JSON.stringify(err.response.data);
      const isHtmlResponse =
        String(err.response.headers?.['content-type'] || '').includes('text/html') ||
        /^\s*<!DOCTYPE html/i.test(rawData) ||
        /^\s*<html/i.test(rawData);

      if (isHtmlResponse) {
        message = `[${err.response.status}] الخادم أعاد صفحة HTML غير متوقعة بدل استجابة التطبيق`;
      } else {
        const dataStr = rawData.substring(0, 140).replace(/\n/g, ' ');
        message = `[${err.response.status}] إجابة غير متوقعة من الخادم: ${dataStr}`;
      }
    } else if (err.request) {
      message = `تعذر الوصول للخادم أو لا توجد استجابة: ${err.message}`;
    } else {
      message = err.message || 'حدث خطأ في الاتصال بالخادم';
    }

    return Promise.reject(new Error(message));
  }
);

export default api;
