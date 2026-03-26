const TOKEN_KEY = 'mudrek_token';
const USER_KEY = 'mudrek_user';

export type UserRole = 'ADMIN' | 'STUDENT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export const saveToken = (token: string) => {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') return localStorage.getItem(TOKEN_KEY);
  return null;
};

export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export const saveUser = (user: AuthUser) => {
  if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = (): AuthUser | null => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  return null;
};
