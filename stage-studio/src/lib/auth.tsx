import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { configured, getSupabase } from './supabase';

interface AuthValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);
const redirect = (path: string) => new URL(path, window.location.origin).href;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const client = getSupabase();
    // The client initializes PKCE URL callbacks automatically. Keep this callback
    // synchronous so it cannot deadlock against the auth client's storage lock.
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) { setUser(session?.user ?? null); setLoading(false); }
    });
    client.auth.getSession().then(({ data, error }) => {
      if (alive) { setUser(error ? null : data.session?.user ?? null); setLoading(false); }
    }).catch(() => { if (alive) { setUser(null); setLoading(false); } });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user, loading,
    async signInWithGoogle() {
      const { error } = await getSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect('/auth/callback') } });
      if (error) throw error;
    },
    async signIn(email, password) {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    async signUp(email, password, name) {
      const { data, error } = await getSupabase().auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim().slice(0, 80) }, emailRedirectTo: redirect('/auth/callback') } });
      if (error) throw error;
      return { needsConfirmation: !data.session };
    },
    async signOut() { const { error } = await getSupabase().auth.signOut(); if (error) throw error; },
    async requestPasswordReset(email) {
      const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect('/reset-password') });
      if (error) throw error;
    },
    async updatePassword(password) {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
    },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('AuthProvider 안에서 useAuth를 사용해 주세요.');
  return auth;
}
