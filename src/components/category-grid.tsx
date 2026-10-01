import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import type { Category } from '@/lib/api/types';
import { haptics } from '@/lib/feedback';
import { categoryName } from '@/lib/i18n';
import { categoryIcon } from '@/lib/icons';

type CategoryGridProps = {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
};

/** Top-level categories as icon tiles: one tap picks, tapping again clears. */
export function CategoryGrid({ categories, value, onChange }: CategoryGridProps) {
  const theme = useTheme();
  const { isLargeText } = useFontScale();
  return (
    <View accessibilityRole="radiogroup" style={styles.grid}>
      {categories.map((category) => {
        const selected = category.id === value;
        const label = categoryName(category.name);
        return (
          <Pressable
            key={category.id}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              haptics.selection();
              onChange(selected ? null : category.id);
            }}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
            <View
              style={[
                styles.icon,
                { backgroundColor: selected ? theme.tint : theme.tintSoft },
              ]}>
              <Ionicons name={categoryIcon(category.name, category.type)} size={22} color={selected ? '#ffffff' : theme.tint} />
            </View>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              themeColor={selected ? 'text' : 'textSecondary'}
              // One word per tile: shrink long names ("Entertainment") to fit
              // rather than breaking them mid-word at large text sizes.
              numberOfLines={1}
              adjustsFontSizeToFit={isLargeText}
              minimumFontScale={0.6}
              style={styles.label}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.two },
  tile: { width: '25%', alignItems: 'center', gap: 4, paddingVertical: 2 },
  pressed: { opacity: 0.7 },
  icon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, lineHeight: 16, textAlign: 'center', paddingHorizontal: 2 },
});
