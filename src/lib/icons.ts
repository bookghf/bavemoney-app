import type { IoniconName } from '@/components/ui/icon-badge';

// Categories carry no icon from the API, so pick one from the name. First
// matching keyword wins; unknown names fall back to a per-type glyph.
const CATEGORY_ICONS: [RegExp, IoniconName][] = [
  [/food|dining|restaurant|grocer|meal|coffee|drink/i, 'fast-food'],
  [/transport|bus|taxi|car|fuel|gas|train|parking/i, 'car'],
  [/cloth|fashion|apparel/i, 'shirt'],
  [/shop/i, 'bag-handle'],
  [/entertain|movie|game|fun|hobby/i, 'film'],
  [/util|electric|water|internet|phone|bill/i, 'flash'],
  [/rent|home|house/i, 'home'],
  [/health|medic|doctor|pharma|fitness|gym/i, 'medkit'],
  [/travel|trip|hotel|flight/i, 'airplane'],
  [/educat|school|course|book/i, 'school'],
  [/gift|donat/i, 'gift'],
  [/salary|wage|payroll/i, 'briefcase'],
  [/bonus|invest|dividend|interest/i, 'trending-up'],
  [/saving/i, 'save'],
  [/subscri/i, 'repeat'],
  [/insur/i, 'shield-checkmark'],
  [/pet/i, 'paw'],
  [/beauty|personal|care/i, 'sparkles'],
];

export function categoryIcon(name: string | undefined, type: string): IoniconName {
  const match = name ? CATEGORY_ICONS.find(([pattern]) => pattern.test(name)) : undefined;
  if (match) return match[1];
  if (type === 'transfer') return 'swap-horizontal';
  if (type === 'income') return 'arrow-down';
  return 'pricetag';
}

const ACCOUNT_ICONS: Record<string, IoniconName> = {
  cash: 'cash',
  bank: 'business',
  credit_card: 'card',
  e_wallet: 'phone-portrait',
};

export function accountIcon(type: string): IoniconName {
  return ACCOUNT_ICONS[type] ?? 'wallet';
}
