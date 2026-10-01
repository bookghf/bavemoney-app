import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reportKeys } from '@/hooks/use-reports';
import { api, normalizeAuthResponse } from '@/lib/api/client';
import type {
  AuthResponse,
  ChangePasswordRequest,
  ResetAccountResponse,
  UpdateProfileRequest,
  User,
} from '@/lib/api/types';
import { useAuthStore } from '@/store/auth-store';
import { usePreferences } from '@/store/preferences-store';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileRequest) => {
      const { data } = await api.patch<{ user: User }>('/me', input);
      return data.user;
    },
    onSuccess: async (user) => {
      await useAuthStore.getState().setUser(user);
      // Reports default to the main currency, so refetch them.
      await queryClient.invalidateQueries({ queryKey: reportKeys.all });
    },
  });
}

/** Changes the password; the API signs out other devices and returns a fresh session for this one. */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: ChangePasswordRequest) => {
      const { data } = await api.post<AuthResponse>('/me/password', input);
      return normalizeAuthResponse(data);
    },
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });
}

/**
 * Erases every transaction, account, budget, and custom category after the
 * API re-checks the password. The session stays; cached data and remembered
 * form picks are dropped so nothing points at deleted rows.
 */
export function useResetAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) => {
      const { data } = await api.post<ResetAccountResponse>('/me/reset', { password });
      return data;
    },
    onSuccess: async () => {
      usePreferences.getState().update({ lastAccountId: null, lastCategoryByType: {} });
      // Back to an empty cache; screens on show refetch the (now empty) data.
      await queryClient.resetQueries();
    },
  });
}
