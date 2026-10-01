import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { Category } from '@/lib/api/types';

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
