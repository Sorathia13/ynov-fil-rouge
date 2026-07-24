import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getAccessToken, setAccessToken } from '../lib/api';
import type { AuthResult, Role, User } from '../types';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: Extract<Role, 'CLIENT' | 'PRO'>;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (getAccessToken()) {
        try {
          const { data } = await api.get<User>('/users/me');
          if (active) setUser(data);
        } catch {
          setAccessToken(null);
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const { data } = await api.post<AuthResult>('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function register(input: RegisterInput): Promise<void> {
    const { data } = await api.post<AuthResult>('/auth/register', input);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  async function refreshUser(): Promise<void> {
    const { data } = await api.get<User>('/users/me');
    setUser(data);
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
