import { create } from 'zustand';

import * as storage from '@/lib/storage/session-storage';

export type Language = 'en' | 'th';
export type CalendarSystem = 'gregory' | 'buddhist';

/** Device-local preferences: display settings and form memory. */
type Preferences = {
  /** null follows the device language. */
  language: Language | null;
  calendar: CalendarSystem;
  /** Account picked last on the add-transaction form. */
  lastAccountId: string | null;
  /** Category picked last per transaction type. */
  lastCategoryByType: Record<string, string | null>;
};

type PreferencesState = Preferences & {
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Preferences>) => void;
};

const KEY = 'ledger.preferences';

const defaults: Preferences = {
  language: null,
  calendar: 'gregory',
  lastAccountId: null,
  lastCategoryByType: {},
};

export const usePreferences = create<PreferencesState>((set, get) => ({
  ...defaults,
  isHydrated: false,

  hydrate: async () => {
    if (get().isHydrated) return;
    try {
      const raw = await storage.getItem(KEY);
      if (raw) set({ ...defaults, ...(JSON.parse(raw) as Partial<Preferences>) });
    } catch (error) {
      console.warn('[preferences] failed to restore', error);
    }
    set({ isHydrated: true });
  },

  update: (patch) => {
    set(patch);
    const { language, calendar, lastAccountId, lastCategoryByType } = get();
    storage
      .setItem(KEY, JSON.stringify({ language, calendar, lastAccountId, lastCategoryByType }))
      .catch((error) => console.warn('[preferences] failed to save', error));
  },
}));
