import { useMutation } from '@tanstack/react-query';

import { api, normalizeAuthResponse } from '@/lib/api/client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/lib/api/types';
import { useAuthStore } from '@/store/auth-store';

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginRequest) => {
      const { data } = await api.post<AuthResponse>('/auth/login', input);
      return normalizeAuthResponse(data);
    },
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterRequest) => {
      const { data } = await api.post<AuthResponse>('/auth/register', input);
      return normalizeAuthResponse(data);
    },
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });
}

/**
 * Revoke the refresh token server-side, then clear the local session.
 * The local session is cleared even if the API call fails (e.g. offline), so
 * the user can always log out.
 */
export function useLogout() {
  return useMutation({
    mutationFn: async ({ all = false }: { all?: boolean } = {}) => {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) return;
      await api.post('/auth/logout', { refresh_token: refreshToken, all });
    },
    onSettled: () => useAuthStore.getState().signOut(),
  });
}
