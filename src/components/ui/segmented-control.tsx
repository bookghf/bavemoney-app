import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/feedback';

type SegmentedControlProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Colors the selected segment, e.g. red for expense. */
  selectedColor?: string;
};

/** iOS-style segmented control for 2–5 mutually exclusive options. */
export function SegmentedControl<T extends string>({ options, value, onChange, selectedColor }: SegmentedControlProps<T>) {
  const theme = useTheme();
  const { isLargeText } = useFontScale();
  return (
    <View accessibilityRole="radiogroup" style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (!selected) haptics.selection();
              onChange(option.value);
            }}
            style={[
              styles.segment,
              selected && [styles.selected, { backgroundColor: theme.surface }],
            ]}>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              // Shrink to fit instead of wrapping: five short segments ("Week",
              // "Month") would otherwise break mid-word at large text sizes.
              numberOfLines={1}
              adjustsFontSizeToFit={isLargeText}
              minimumFontScale={0.6}
              style={[styles.label, selected && selectedColor ? { color: selectedColor } : undefined]}
              themeColor={selected ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  label: { textAlign: 'center' },
  segment: { flex: 1, minHeight: 38, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, paddingHorizontal: 6 },
  selected: { boxShadow: '0 1px 4px rgba(15, 18, 34, 0.12)' },
});
