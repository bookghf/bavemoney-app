import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
      // On native, refetch-on-focus is driven by AppState via focusManager
      // (wired up in AppProviders), not by the web "window focus" event.
      refetchOnWindowFocus: false,
    },
  },
});
