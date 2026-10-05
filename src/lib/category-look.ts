import { Ionicons } from '@expo/vector-icons';

import type { IoniconName } from '@/components/ui/icon-badge';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { categoryIcon } from '@/lib/icons';

/**
 * Category colors. Each category keeps one hue everywhere (picker tile, list
 * row, budget, chart), so people can scan by category. Whether money came in
 * or went out is shown by the amount's color and sign, not by the tile.
 *
 * Keys match the API's category `color` values. Per mode:
 *  - fg: icon on the soft tile (≥ 3:1 against bg)
 *  - bg: the soft tile
 *  - solid: selected tile behind a white icon (≥ 3:1 with white)
 *  - chart: fill for chart slices and bars on the card surface
 */
const PALETTE = {
  orange: { light: ['#C2410C', '#FFEDD5', '#C2410C'], dark: ['#FDBA74', '#3B2412', '#C2410C'] },
  amber: { light: ['#B45309', '#FEF3C7', '#B45309'], dark: ['#FCD34D', '#3A2E0F', '#B45309'] },
  lime: { light: ['#4D7C0F', '#ECFCCB', '#4D7C0F'], dark: ['#BEF264', '#26330F', '#4D7C0F'] },
  cyan: { light: ['#0E7490', '#CFFAFE', '#0E7490'], dark: ['#67E8F9', '#0F3038', '#0E7490'] },
  indigo: { light: ['#4338CA', '#E0E7FF', '#4338CA'], dark: ['#A5B4FC', '#23264A', '#4338CA'] },
  violet: { light: ['#6D28D9', '#EDE9FE', '#6D28D9'], dark: ['#C4B5FD', '#2C2248', '#6D28D9'] },
  fuchsia: { light: ['#A21CAF', '#FAE8FF', '#A21CAF'], dark: ['#F0ABFC', '#3A1B3F', '#A21CAF'] },
  pink: { light: ['#BE185D', '#FCE7F3', '#BE185D'], dark: ['#F9A8D4', '#3D1A2C', '#BE185D'] },
  brown: { light: ['#92400E', '#F5E9DC', '#92400E'], dark: ['#D6B38A', '#33261A', '#92400E'] },
  slate: { light: ['#475569', '#E2E8F0', '#475569'], dark: ['#CBD5E1', '#262C36', '#475569'] },
} as const;

export type CategoryColorKey = keyof typeof PALETTE;
export const CATEGORY_COLORS = Object.keys(PALETTE) as CategoryColorKey[];

/** Icons offered when creating a category. */
export const CATEGORY_ICON_CHOICES: IoniconName[] = [
  'fast-food', 'cafe', 'beer', 'cart', 'basket', 'bag-handle', 'shirt', 'car', 'bus', 'train', 'boat', 'bicycle',
  'airplane', 'home', 'key', 'flash', 'water', 'wifi', 'phone-portrait', 'medkit', 'fitness', 'sparkles', 'cut',
  'school', 'book', 'game-controller', 'film', 'musical-notes', 'paw', 'heart', 'gift', 'ticket', 'briefcase',
  'laptop', 'cash', 'card', 'trending-up', 'repeat', 'construct', 'ellipsis-horizontal-circle',
];

export type CategoryLook = { icon: IoniconName; fg: string; bg: string; solid: string; chart: string };

type LookInput = { name?: string; icon?: string | null; color?: string | null; type?: string } | null | undefined;

function isColorKey(value: string | null | undefined): value is CategoryColorKey {
  return !!value && value in PALETTE;
}

/** Stable color for categories without one, from their name. */
function hashColor(name: string): CategoryColorKey {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  // Slate is kept for "no category" and "other".
  const choices = CATEGORY_COLORS.filter((key) => key !== 'slate');
  return choices[hash % choices.length];
}

export function categoryLook(category: LookInput, scheme: 'light' | 'dark', fallbackType = 'expense'): CategoryLook {
  const key: CategoryColorKey = !category
    ? 'slate'
    : isColorKey(category.color)
      ? category.color
      : hashColor(category.name ?? '');
  const [fg, bg, solid] = PALETTE[key][scheme];
  const icon =
    category?.icon && category.icon in Ionicons.glyphMap
      ? (category.icon as IoniconName)
      : categoryIcon(category?.name, category?.type ?? fallbackType);
  return { icon, fg, bg, solid, chart: scheme === 'dark' ? fg : solid };
}

/** categoryLook bound to the current light/dark mode. */
export function useCategoryLook() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (category: LookInput, fallbackType?: string) => categoryLook(category, scheme, fallbackType);
}

/** Swatch for the color picker in the current mode. */
export function swatchColor(key: CategoryColorKey, scheme: 'light' | 'dark') {
  return PALETTE[key][scheme][2];
}
