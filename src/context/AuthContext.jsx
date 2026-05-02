import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { db } from '../lib/db';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Run cloud sync after sign-in and dispatch data-synced event
  const syncAllData = useCallback(async (authUser) => {
    if (!authUser || !isConfigured) return;
    setSyncing(true);
    try {
      await Promise.all([
        db.portfolio.sync(authUser.id),
        db.conversations.sync(authUser.id),
        db.savedScreens.sync(authUser.id),
        db.recentResearch.sync(authUser.id),
      ]);
      window.dispatchEvent(new CustomEvent('ov:data-synced'));
    } catch (err) {
      console.warn('[AuthContext.syncAllData]', err?.message || err);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) syncAllData(u);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (event === 'SIGNED_IN' && u) {
          syncAllData(u);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [syncAllData]);

  const signIn = useCallback(async (email, password) => {
    if (!isConfigured) {
      throw new Error(
        'Supabase not configured — add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to .env'
      );
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!isConfigured) {
      throw new Error(
        'Supabase not configured — add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to .env'
      );
    }
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthContext.signOut]', err?.message || err);
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, syncing, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
