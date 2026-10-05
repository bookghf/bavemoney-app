import { useAuthStore } from '@/store/auth-store';

/** The day (1-28) the signed-in user's month starts on; 1 means calendar months. */
export function useMonthStartDay(): number {
  return useAuthStore((state) => state.user?.month_start_day) ?? 1;
}
