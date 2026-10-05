import { flattenCategories } from '@/hooks/use-categories';
import type { Category } from '@/lib/api/types';
import { TH } from '@/lib/i18n-th';

/**
 * IDs of system categories whose Thai name contains `query`, so a search for
 * "อาหาร" finds Food. The API stores system categories in English and matches
 * stored names itself; only the translations live in the app, so it resolves
 * them here and sends the IDs as `search_categories`. Thai names are matched
 * whatever the app language, since people may type either.
 */
export function translatedCategoryMatches(query: string, tree: Category[]): string[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return flattenCategories(tree)
    .filter((category) => {
      const thai = category.is_system ? TH[`category:${category.name}`] : undefined;
      return !!thai && thai.toLocaleLowerCase().includes(needle);
    })
    .map((category) => category.id);
}
