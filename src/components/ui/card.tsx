import { StyleSheet, type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** Raised surface on the app canvas: soft shadow in light mode, hairline border in dark. */
export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';
  return (
    <ThemedView
      type="surface"
      style={[
        styles.card,
        isDark ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border } : styles.shadow,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: Spacing.three, gap: Spacing.two },
  shadow: { boxShadow: '0 2px 12px rgba(15, 18, 34, 0.06)' },
});
