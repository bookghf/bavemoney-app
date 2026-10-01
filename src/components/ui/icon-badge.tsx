import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import type { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IoniconName = keyof typeof Ionicons.glyphMap;

type Tone = 'tint' | 'success' | 'danger' | 'neutral';

const TONES: Record<Tone, { fg: ThemeColor; bg: ThemeColor }> = {
  tint: { fg: 'tint', bg: 'tintSoft' },
  success: { fg: 'success', bg: 'successSoft' },
  danger: { fg: 'danger', bg: 'dangerSoft' },
  neutral: { fg: 'textSecondary', bg: 'backgroundElement' },
};

/** Rounded square holding an icon on a soft tinted background. */
export function IconBadge({ icon, tone = 'tint', size = 40 }: { icon: IoniconName; tone?: Tone; size?: number }) {
  const theme = useTheme();
  const { fg, bg } = TONES[tone];
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: theme[bg] }]}>
      <Ionicons name={icon} size={size * 0.5} color={theme[fg]} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
