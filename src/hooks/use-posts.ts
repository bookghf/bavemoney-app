import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export type Post = {
  id: number;
  title: string;
  body: string;
};

// Centralized, typed query keys make cache invalidation predictable.
export const postKeys = {
  all: ['posts'] as const,
  detail: (id: number) => ['posts', id] as const,
};

export function usePosts() {
  return useQuery({
    queryKey: postKeys.all,
    queryFn: async () => {
      const { data } = await api.get<Post[]>('/posts');
      return data;
    },
  });
}

export function usePost(id: number) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Post>(`/posts/${id}`);
      return data;
    },
    enabled: Number.isFinite(id),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Post, 'id'>) => {
      const { data } = await api.post<Post>('/posts', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}
