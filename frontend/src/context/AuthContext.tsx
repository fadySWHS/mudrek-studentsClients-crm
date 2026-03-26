'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthUser, getUser, getToken, removeToken, saveToken, saveUser } from '@/utils/auth';
import { authService } from '@/services/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const savedUser = getUser();
    if (token && savedUser) {
      setUser(savedUser);
      // Verify token is still valid
      authService.me().then((fresh) => {
        setUser(fresh);
        saveUser(fresh);
      }).catch(() => {
        removeToken();
        setUser(null);
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: authUser } = await authService.login(email, password);
    saveToken(token);
    saveUser(authUser);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      logout,
      isAdmin: user?.role === 'ADMIN',
      isStudent: user?.role === 'STUDENT',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
