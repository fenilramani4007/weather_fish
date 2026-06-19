import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  hobbies: string[];
  created_at?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { username?: string; hobbies?: string[] }) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'wf_token';
const USER_KEY  = 'wf_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser]   = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  // Verify token on mount (handles expiry)
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(u => { setUser(u); localStorage.setItem(USER_KEY, JSON.stringify(u)); })
      .catch(() => { setToken(null); setUser(null); localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); });
  }, []);

  const _persist = (t: string, u: AuthUser) => {
    setToken(t); setUser(u);
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  const _parseResponse = async (r: Response, fallback: string) => {
    const text = await r.text();
    try { return { ok: r.ok, data: JSON.parse(text) }; }
    catch { return { ok: r.ok, data: { detail: r.ok ? fallback : `Server error (${r.status})` } }; }
  };

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const { ok, data } = await _parseResponse(r, 'Login failed');
      if (!ok) throw new Error(data.detail || 'Login failed');
      _persist(data.token, data.user);
    } finally { setLoading(false); }
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      });
      const { ok, data } = await _parseResponse(r, 'Registration failed');
      if (!ok) throw new Error(data.detail || 'Registration failed');
      _persist(data.token, data.user);
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(() => {
    setToken(null); setUser(null);
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY);
  }, []);

  const updateProfile = useCallback(async (data: { username?: string; hobbies?: string[] }) => {
    const r = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const updated = await r.json();
    if (!r.ok) throw new Error(updated.detail || 'Update failed');
    setUser(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    return updated as AuthUser;
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
