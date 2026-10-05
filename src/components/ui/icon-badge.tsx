import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IoniconName = keyof typeof Ionicons.glyphMap;

type Tone = 'tint' | 'success' | 'danger' | 'transfer' | 'neutral';

const TONES: Record<Tone, { fg: ThemeColor; bg: ThemeColor }> = {
  tint: { fg: 'tint', bg: 'tintSoft' },
  success: { fg: 'success', bg: 'successSoft' },
  danger: { fg: 'danger', bg: 'dangerSoft' },
  transfer: { fg: 'transfer', bg: 'transferSoft' },
  neutral: { fg: 'textSecondary', bg: 'backgroundElement' },
};

/** Rounded square holding an icon on a soft tinted background. */
export function IconBadge({
  icon,
  tone = 'tint',
  size = 40,
  colors,
}: {
  icon: IoniconName;
  tone?: Tone;
  size?: number;
  /** Explicit colors (e.g. a category's own hue) instead of a theme tone. */
  colors?: { fg: string; bg: string };
}) {
  const theme = useTheme();
  const fg = colors?.fg ?? theme[TONES[tone].fg];
  const bg = colors?.bg ?? theme[TONES[tone].bg];
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg }]}>
      <Ionicons name={icon} size={size * 0.5} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
