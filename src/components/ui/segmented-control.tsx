import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
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
    // With large text, segments size to their labels and wrap onto a second
    // row instead of being squeezed into equal widths that split words.
    <View
      accessibilityRole="radiogroup"
      style={[styles.track, isLargeText && styles.trackWrap, { backgroundColor: theme.backgroundElement }]}>
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
              isLargeText ? styles.segmentWrap : styles.segmentEqual,
              selected && [styles.selected, { backgroundColor: theme.surface }],
            ]}>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              numberOfLines={isLargeText ? undefined : 1}
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

/** Gap between the track and the selected segment. */
const TRACK_PADDING = 3;

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: Radius.md, padding: TRACK_PADDING },
  label: { textAlign: 'center' },
  trackWrap: { flexWrap: 'wrap', gap: TRACK_PADDING },
  // Grow from the label's own width, so a word always fits on one line.
  segmentWrap: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', paddingHorizontal: 12 },
  // Equal widths normally; see segmentWrap for large text.
  segmentEqual: { flex: 1 },
  // 44pt is the minimum touch target; the radius stays concentric with the track.
  segment: {
    minHeight: 44,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md - TRACK_PADDING,
    paddingHorizontal: 6,
  },
  selected: { boxShadow: '0 1px 4px rgba(15, 18, 34, 0.12)' },
});
