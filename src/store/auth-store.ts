import { create } from 'zustand';

export type User = {
  id: string;
  name: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  signIn: (payload: { token: string; user: User }) => void;
  setToken: (token: string | null) => void;
  signOut: () => void;
};

/**
 * Global auth store. Read reactively in components with `useAuthStore(...)`,
 * or imperatively outside React with `useAuthStore.getState()`
 * (see the axios interceptor in src/lib/api/client.ts).
 */
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  signIn: ({ token, user }) => set({ token, user, isAuthenticated: true }),
  setToken: (token) => set({ token, isAuthenticated: token != null }),
  signOut: () => set({ token: null, user: null, isAuthenticated: false }),
}));
