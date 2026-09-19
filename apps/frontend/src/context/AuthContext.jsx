import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokens } from '@/lib/api';
import { connectSocket, disconnectSocket, reconnectSocket } from '@/lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `loading` covers the first session restore, so routes do not flash.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokens.access) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (cancelled) return;
        setUser(me);
        connectSocket();
      } catch {
        tokens.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback((session) => {
    tokens.set(session.tokens);
    setUser(session.user);
    reconnectSocket();
    return session.user;
  }, []);

  const signIn = useCallback(
    async (credentials) => adopt(await authApi.login(credentials)),
    [adopt],
  );

  const signUp = useCallback(async (payload) => adopt(await authApi.register(payload)), [adopt]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Signing out locally must work even if the request fails.
    }
    tokens.clear();
    disconnectSocket();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, setUser }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
