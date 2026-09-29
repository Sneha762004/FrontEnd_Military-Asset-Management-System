import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, registerUnauthorizedHandler, tokenStore } from '../lib/api';
import type { CurrentUser, Permission } from '../types';

interface AuthState {
  user: CurrentUser | null;
  initialising: boolean;
  signIn: (username: string, password: string) => Promise<CurrentUser>;
  signOut: () => void;
  can: (permission: Permission) => boolean;
  isGlobal: boolean;
  baseId: number | null;
}

const AuthContext = createContext<AuthState | null>(null);

interface LoginResponse {
  token: string;
  user: CurrentUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [initialising, setInitialising] = useState(true);

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // One place clears the session on a 401, so no screen has to remember to do it.
  useEffect(() => {
    registerUnauthorizedHandler(signOut);
    return () => registerUnauthorizedHandler(() => undefined);
  }, [signOut]);

  // A stored token is not proof of a valid session: re-validate it on boot so a
  // revoked or expired account is never shown a half-working UI.
  useEffect(() => {
    let cancelled = false;
    const token = tokenStore.get();
    if (!token) {
      setInitialising(false);
      return;
    }
    api
      .get<CurrentUser>('/auth/me')
      .then((res) => {
        if (!cancelled) setUser(res.data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          if (!(error instanceof ApiError) || error.isAuthFailure) tokenStore.clear();
        }
      })
      .finally(() => {
        if (!cancelled) setInitialising(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { username, password });
    tokenStore.set(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const value = useMemo<AuthState>(() => {
    const permissions = new Set(user?.permissions ?? []);
    return {
      user,
      initialising,
      signIn,
      signOut,
            can: (permission: Permission) => permissions.has(permission),
      isGlobal: user?.role === 'ADMIN',
      baseId: user?.baseId ?? null,
    };
  }, [user, initialising, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
