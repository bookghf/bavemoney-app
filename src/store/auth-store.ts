import { create } from 'zustand';

import type { AuthResponse, User } from '@/lib/api/types';
import { queryClient } from '@/lib/query-client';
import * as sessionStorage from '@/lib/storage/session-storage';

export type { User } from '@/lib/api/types';

const KEYS = {
  accessToken: 'ledger.accessToken',
  refreshToken: 'ledger.refreshToken',
  user: 'ledger.user',
} as const;

type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  /** False until the persisted session has been read on startup. */
  isHydrated: boolean;
  /** Load the persisted session (call once on startup). */
  hydrate: () => Promise<void>;
  /** Store a session from a register/login/refresh response and persist it. */
  setSession: (response: AuthResponse) => Promise<void>;
  /** Replace the signed-in user after a profile edit and persist it. */
  setUser: (user: User) => Promise<void>;
  /** Clear the session locally (does not call the API; see useLogout). */
  signOut: () => Promise<void>;
};

async function persist(session: Session) {
  await Promise.all([
    sessionStorage.setItem(KEYS.accessToken, session.accessToken),
    sessionStorage.setItem(KEYS.refreshToken, session.refreshToken),
    sessionStorage.setItem(KEYS.user, JSON.stringify(session.user)),
  ]);
}

async function clearPersisted() {
  await Promise.all(Object.values(KEYS).map((key) => sessionStorage.removeItem(key)));
}

/**
 * Global auth store. Read reactively in components with `useAuthStore(...)`,
 * or imperatively outside React with `useAuthStore.getState()`
 * (see the axios interceptors in src/lib/api/client.ts).
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const [accessToken, refreshToken, rawUser] = await Promise.all([
        sessionStorage.getItem(KEYS.accessToken),
        sessionStorage.getItem(KEYS.refreshToken),
        sessionStorage.getItem(KEYS.user),
      ]);
      const user = rawUser ? (JSON.parse(rawUser) as User) : null;
      if (accessToken && refreshToken && user) {
        set({ accessToken, refreshToken, user, isAuthenticated: true, isHydrated: true });
        return;
      }
    } catch (error) {
      console.warn('[auth] failed to restore session', error);
    }
    set({ isHydrated: true });
  },

  setSession: async ({ token, refresh_token, user }) => {
    const session = { accessToken: token, refreshToken: refresh_token, user };
    set({ ...session, isAuthenticated: true });
    try {
      await persist(session);
    } catch (error) {
      console.warn('[auth] failed to persist session', error);
    }
  },

  setUser: async (user) => {
    if (!get().isAuthenticated) return;
    set({ user });
    try {
      await sessionStorage.setItem(KEYS.user, JSON.stringify(user));
    } catch (error) {
      console.warn('[auth] failed to persist user', error);
    }
  },

  signOut: async () => {
    set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
    // Drop cached data so the next user never sees the previous user's data.
    queryClient.clear();
    try {
      await clearPersisted();
    } catch (error) {
      console.warn('[auth] failed to clear session', error);
    }
  },
}));
