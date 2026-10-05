import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import type { Category } from '@/lib/api/types';
import { useCategoryLook } from '@/lib/category-look';
import { haptics } from '@/lib/feedback';
import { categoryName, t } from '@/lib/i18n';

type CategoryGridProps = {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Shows a "+ New" tile that starts creating a category. */
  onAdd?: () => void;
};

/**
 * Top-level categories in their own colors: one tap picks, tapping again
 * clears. Normally a 4-column icon grid; with large text the fixed-width
 * tiles can not hold a word like "Entertainment", so they become
 * content-sized pills that wrap onto new rows and never split a word.
 */
export function CategoryGrid({ categories, value, onChange, onAdd }: CategoryGridProps) {
  const theme = useTheme();
  const lookOf = useCategoryLook();
  const { isLargeText } = useFontScale();

  const addTile = onAdd ? (
    <Pressable
      key="add"
      accessibilityRole="button"
      accessibilityLabel={t('New category')}
      onPress={onAdd}
      style={({ pressed }) => [isLargeText ? [styles.pill, { borderColor: theme.border, borderStyle: 'dashed' }] : styles.tile, pressed && styles.pressed]}>
      {isLargeText ? (
        <>
          <Ionicons name="add" size={20} color={theme.tint} />
          <ThemedText type="small" themeColor="tint">
            {t('New')}
          </ThemedText>
        </>
      ) : (
        <>
          <View style={[styles.icon, styles.addIcon, { borderColor: theme.border }]}>
            <Ionicons name="add" size={24} color={theme.tint} />
          </View>
          <ThemedText type="small" themeColor="tint" numberOfLines={1} style={styles.label}>
            {t('New')}
          </ThemedText>
        </>
      )}
    </Pressable>
  ) : null;

  return (
    <View accessibilityRole="radiogroup" style={isLargeText ? styles.pills : styles.grid}>
      {categories.map((category) => {
        const selected = category.id === value;
        const label = categoryName(category.name);
        const look = lookOf(category);
        const select = () => {
          haptics.selection();
          onChange(selected ? null : category.id);
        };

        if (isLargeText) {
          return (
            <Pressable
              key={category.id}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={select}
              style={({ pressed }) => [
                styles.pill,
                selected
                  ? { backgroundColor: look.solid, borderColor: look.solid }
                  : { backgroundColor: theme.surface, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons name={look.icon} size={20} color={selected ? '#ffffff' : look.fg} />
              <ThemedText type={selected ? 'smallBold' : 'small'} style={selected ? styles.selectedText : undefined}>
                {label}
              </ThemedText>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={category.id}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            onPress={select}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <View style={[styles.icon, { backgroundColor: selected ? look.solid : look.bg }]}>
              <Ionicons name={look.icon} size={22} color={selected ? '#ffffff' : look.fg} />
            </View>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              themeColor={selected ? 'text' : 'textSecondary'}
              numberOfLines={1}
              style={styles.label}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
      {addTile}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.two },
  tile: { width: '25%', alignItems: 'center', gap: 4, paddingVertical: 2 },
  pressed: { opacity: 0.7 },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addIcon: { borderWidth: 1.5, borderStyle: 'dashed' },
  label: { fontSize: 12, lineHeight: 16, textAlign: 'center', paddingHorizontal: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 22,
    borderWidth: 1,
  },
  selectedText: { color: '#ffffff' },
});
