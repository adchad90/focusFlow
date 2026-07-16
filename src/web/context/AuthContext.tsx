import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../api';
import type { User, Curation } from '../types';

interface AuthState {
  user: User | null;
  curations: Curation[];
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setCurations: React.Dispatch<React.SetStateAction<Curation[]>>;
  refreshCurations: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [curations, setCurations] = useState<Curation[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCurations = useCallback(async () => {
    try {
      const data = await api.getCurations();
      setCurations(data);
    } catch {
      // silent — user may not be authenticated
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setCurations([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.getMe();
        if (cancelled) return;
        setUser(me);
        await refreshCurations();
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshCurations]);

  return (
    <AuthContext.Provider value={{ user, curations, loading, setUser, setCurations, refreshCurations, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
