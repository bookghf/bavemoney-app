import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  /** quiet = soft gray button with red text, for destructive secondary actions. */
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const filled = variant === 'primary' || variant === 'danger';
  // Disabled gets its own colors instead of fading, so it stays readable.
  const background = disabled
    ? theme.backgroundSelected
    : variant === 'primary'
      ? theme.tint
      : variant === 'danger'
        ? theme.danger
        : theme.backgroundElement;
  const foreground = disabled
    ? theme.textSecondary
    : filled
      ? '#ffffff'
      : variant === 'quiet'
        ? theme.danger
        : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        { backgroundColor: background, opacity: state.pressed ? 0.85 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <ThemedText type="smallBold" style={[styles.label, { color: foreground }]}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16 },
});
