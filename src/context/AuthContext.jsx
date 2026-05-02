import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { portfolio, conversations, savedScreens, recentResearch, watchlist, alerts } from '../lib/db';

const AuthContext = createContext({
  user:     null,
  loading:  true,
  syncing:  false,
  signIn:   async () => {},
  signUp:   async () => {},
  signOut:  async () => {},
});

export function useAuth() { return useContext(AuthContext); }

async function syncAllDown(userId) {
  await Promise.all([
    portfolio.sync(userId),
    conversations.sync(userId),
    savedScreens.sync(userId),
    recentResearch.sync(userId),
    watchlist.sync(userId),
    alerts.sync(userId),
  ]);
  window.dispatchEvent(new Event('ov:data-synced'));
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setSyncing(true);
        syncAllDown(session.user.id).finally(() => setSyncing(false));
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setSyncing(true);
        syncAllDown(u.id).finally(() => setSyncing(false));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!isConfigured) throw new Error('Supabase not configured — add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to .env');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!isConfigured) throw new Error('Supabase not configured — add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to .env');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, syncing, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
