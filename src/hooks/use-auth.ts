import { useMutation } from '@tanstack/react-query';

import { api, normalizeAuthResponse } from '@/lib/api/client';
import type { AuthResponse, LoginRequest, RegisterRequest, ResetPasswordRequest } from '@/lib/api/types';
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
 * Ask the API to email a 6-digit reset code. It answers the same whether or
 * not the email has an account.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      await api.post('/auth/forgot-password', { email });
    },
  });
}

/** Set a new password with the emailed code; signs in on success. */
export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordRequest) => {
      const { data } = await api.post<AuthResponse>('/auth/reset-password', input);
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
