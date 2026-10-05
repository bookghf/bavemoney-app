import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import { api } from '@/lib/api/client';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@/lib/api/types';

export const categoryKeys = {
  all: ['categories'] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
};

/** Flatten the parent/children tree into a single list (children after parent). */
export function flattenCategories(tree: Category[]): Category[] {
  return tree.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: async () => {
      const { data } = await api.get<{ categories: Category[] }>('/categories');
      return data.categories ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * The category created most recently from a form ("+ New" in the category
 * picker), so that form can select it when the user comes back.
 */
export const useJustCreatedCategory = create<{ category: Category | null; set: (c: Category | null) => void }>(
  (set) => ({ category: null, set: (category) => set({ category }) }),
);

/** Category names and looks show on transactions, budgets, and reports too. */
function invalidateCategoryViews(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all(
    [categoryKeys.all, ['transactions'], ['reports'], ['budgets']].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCategoryRequest) => {
      const { data } = await api.post<Category>('/categories', input);
      return data;
    },
    onSuccess: (category) => {
      useJustCreatedCategory.getState().set(category);
      return invalidateCategoryViews(queryClient);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCategoryRequest & { id: string }) => {
      await api.patch(`/categories/${id}`, input);
    },
    onSuccess: () => invalidateCategoryViews(queryClient),
  });
}

/** Deleting keeps transactions (they become uncategorized) and drops budgets on it. */
export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => invalidateCategoryViews(queryClient),
  });
}
