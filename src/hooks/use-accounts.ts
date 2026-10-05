import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type {
  Account,
  CreateAccountRequest,
  Currency,
  ReconcileAccountRequest,
  UpdateAccountRequest,
} from '@/lib/api/types';

// Centralized, typed query keys make cache invalidation predictable.
export const accountKeys = {
  all: ['accounts'] as const,
  list: () => [...accountKeys.all, 'list'] as const,
  detail: (id: string) => [...accountKeys.all, 'detail', id] as const,
};

/** Every account, archived ones included (screens filter as they need). */
export function useAccounts() {
  return useQuery({
    queryKey: accountKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts', {
        params: { include_archived: true },
      });
      return data.accounts ?? [];
    },
  });
}

/** Currencies the API accepts for accounts and budgets. */
export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data } = await api.get<{ currencies: Currency[] }>('/currencies');
      return data.currencies ?? [];
    },
    staleTime: 60 * 60_000,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAccountRequest) => {
      const { data } = await api.post<{ account: Account }>('/accounts', input);
      return data.account;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateAccountRequest & { id: string }) => {
      const { data } = await api.patch<{ account: Account }>(`/accounts/${id}`, input);
      return data.account;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: accountKeys.all }),
        // Transactions embed the account name. Keyed by literal to avoid an
        // import cycle with use-transactions (which imports accountKeys).
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      ]),
  });
}

/**
 * Match the account to the real balance today. The API back-computes the
 * opening balance in one database transaction, so reports are unchanged.
 */
export function useReconcileAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ReconcileAccountRequest & { id: string }) => {
      const { data } = await api.post<{ account: Account }>(`/accounts/${id}/reconcile`, input);
      return data.account;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
