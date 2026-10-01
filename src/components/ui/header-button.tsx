import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';

type HeaderButtonProps = {
  label: string;
  onPress: () => void;
  /** Leading chevron, for Back buttons. */
  back?: boolean;
};

/** Text button for the navigation bar's top-left or top-right slot. */
export function HeaderButton({ label, onPress, back }: HeaderButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      {back ? <Ionicons name="chevron-back" size={22} color={theme.tint} /> : null}
      {/* Matches the native navigation bar, whose titles grow only a little. */}
      <ThemedText themeColor="tint" maxFontSizeMultiplier={FontScaleCap.display}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 8 },
  pressed: { opacity: 0.6 },
});
