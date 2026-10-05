import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/feedback';

export type ChipOption<T extends string> = { value: T; label: string };

type ChipSelectProps<T extends string> = {
  /** Omit for an unlabeled row, e.g. a segmented control under a section title. */
  label?: string;
  options: readonly ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Tapping the selected chip again clears the selection. */
  allowDeselect?: boolean;
  onClear?: () => void;
  /** One horizontally scrolling row instead of wrapping onto several lines. */
  scroll?: boolean;
};

/** A row of selectable chips — a simple cross-platform single-choice picker. */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  allowDeselect,
  onClear,
  scroll,
}: ChipSelectProps<T>) {
  const theme = useTheme();
  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={() => {
          haptics.selection();
          if (selected && allowDeselect) onClear?.();
          else onChange(option.value);
        }}
        style={({ pressed }) => [
          styles.chip,
          selected
            ? { backgroundColor: theme.tintFill, borderColor: theme.tintFill }
            : { backgroundColor: theme.surface, borderColor: theme.border },
          pressed && styles.pressed,
        ]}>
        <ThemedText type={selected ? 'smallBold' : 'small'} style={selected ? styles.selectedText : undefined} numberOfLines={1}>
          {option.label}
        </ThemedText>
      </Pressable>
    );
  });

  return (
    <View style={styles.field}>
      {label ? (
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="radiogroup"
          contentContainerStyle={styles.scrollRow}
          style={styles.scroll}>
          {chips}
        </ScrollView>
      ) : (
        <View accessibilityRole="radiogroup" style={styles.row}>
          {chips}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Bleed to the screen edges so chips scroll under the gutter.
  scroll: { marginHorizontal: -20 },
  scrollRow: { gap: Spacing.two, paddingHorizontal: 20 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    borderWidth: 1,
  },
  pressed: { opacity: 0.75 },
  selectedText: { color: '#ffffff' },
});
