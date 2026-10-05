import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import type { IoniconName } from '@/components/ui/icon-badge';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IoniconName;
  accessibilityLabel: string;
  /** Filled brand button instead of the soft surface one. */
  primary?: boolean;
};

/** Round 40pt icon button for header actions. */
export function IconButton({ icon, primary, ...rest }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.tintFill : theme.surface, opacity: pressed ? 0.7 : 1 },
      ]}
      {...rest}>
      <Ionicons name={icon} size={22} color={primary ? '#ffffff' : theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', padding: 8 },
});
