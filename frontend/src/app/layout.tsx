import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';

export const metadata: Metadata = {
  title: 'مدرك — نظام إدارة العملاء',
  description: 'منصة توزيع العملاء المحتملين وإدارة المتابعات لمدرك',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'Cairo, sans-serif',
                fontSize: '14px',
                direction: 'rtl',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
