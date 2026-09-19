import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UserRole } from '@vcs/shared';
import { ApiError, authApi, tokens } from '@/lib/api';

const AuthContext = createContext(null);

const ADMIN_ROLES = [UserRole.Admin, UserRole.SuperAdmin];

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
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
        if (!cancelled && ADMIN_ROLES.includes(me.role)) setAdmin(me);
        else tokens.clear();
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

  const signIn = useCallback(async (credentials) => {
    const session = await authApi.login(credentials);

    // The API lets anyone sign in; only this app insists on a staff role.
    if (!ADMIN_ROLES.includes(session.user.role)) {
      throw new ApiError(403, 'FORBIDDEN', 'This account does not have admin access');
    }

    tokens.set(session.tokens);
    setAdmin(session.user);
    return session.user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Signing out locally must work even if the request fails.
    }
    tokens.clear();
    setAdmin(null);
  }, []);

  const value = useMemo(
    () => ({ admin, loading, signIn, signOut, isSuperAdmin: admin?.role === UserRole.SuperAdmin }),
    [admin, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
