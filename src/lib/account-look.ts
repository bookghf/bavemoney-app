import type { IoniconName } from '@/components/ui/icon-badge';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CATEGORY_COLORS, categoryLook, type CategoryColorKey } from '@/lib/category-look';
import { accountIcon } from '@/lib/icons';

/**
 * Account colors reuse the category palette keys. Accounts without a saved
 * color get one per type, so a fresh cash wallet and a bank account already
 * look different.
 */
const TYPE_COLORS: Record<string, CategoryColorKey> = {
  cash: 'lime',
  bank: 'indigo',
  credit_card: 'orange',
  e_wallet: 'violet',
};

export const ACCOUNT_COLORS = CATEGORY_COLORS;

export type AccountLook = { icon: IoniconName; fg: string; bg: string; solid: string };

function isColorKey(value: string | null | undefined): value is CategoryColorKey {
  return !!value && (CATEGORY_COLORS as string[]).includes(value);
}

/** The saved color, or the type's default. */
export function accountColorKey(account: { type: string; color?: string | null }): CategoryColorKey {
  return isColorKey(account.color) ? account.color : (TYPE_COLORS[account.type] ?? 'slate');
}

export function accountLook(account: { type: string; color?: string | null }, scheme: 'light' | 'dark'): AccountLook {
  const { fg, bg, solid } = categoryLook({ color: accountColorKey(account) }, scheme);
  return { icon: accountIcon(account.type), fg, bg, solid };
}

/** accountLook bound to the current light/dark mode. */
export function useAccountLook() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (account: { type: string; color?: string | null }) => accountLook(account, scheme);
}
