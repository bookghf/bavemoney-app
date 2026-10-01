import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '@/lib/api/types';
import { deviceTimeZone } from '@/lib/dates';

export const budgetKeys = {
  all: ['budgets'] as const,
  list: () => [...budgetKeys.all, 'list'] as const,
};

/** Budgets with spend so far in the period that contains today (device time zone). */
export function useBudgets() {
  return useQuery({
    queryKey: budgetKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<{ budgets: Budget[] }>('/budgets', {
        params: { tz: deviceTimeZone() },
      });
      return data.budgets ?? [];
    },
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBudgetRequest) => {
      const { data } = await api.post<{ budget: Budget }>('/budgets', input, {
        params: { tz: deviceTimeZone() },
      });
      return data.budget;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateBudgetRequest & { id: string }) => {
      const { data } = await api.patch<{ budget: Budget }>(`/budgets/${id}`, input, {
        params: { tz: deviceTimeZone() },
      });
      return data.budget;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/budgets/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}
