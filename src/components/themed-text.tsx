import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { currentLanguage } from '@/lib/i18n';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'largeTitle' | 'sectionTitle' | 'amount' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

// Every text follows the device text size; big display text grows least.
const SCALE_CAP: Record<NonNullable<ThemedTextProps['type']>, number> = {
  title: FontScaleCap.display,
  largeTitle: FontScaleCap.display,
  amount: FontScaleCap.display,
  subtitle: FontScaleCap.heading,
  sectionTitle: FontScaleCap.heading,
  default: FontScaleCap.body,
  small: FontScaleCap.body,
  smallBold: FontScaleCap.body,
  link: FontScaleCap.body,
  linkPrimary: FontScaleCap.body,
  code: FontScaleCap.body,
};

// Thai stacks vowels and tone marks above and below the letters, so the line
// heights leave about 1.5–1.6x the font size. Negative tracking would crowd
// those marks, so headings only tighten in English. The root layout remounts
// the screens when the language changes, so reading it during render is safe.
const LATIN_TRACKING: Partial<Record<NonNullable<ThemedTextProps['type']>, { letterSpacing: number }>> = {
  largeTitle: { letterSpacing: -0.6 },
  sectionTitle: { letterSpacing: -0.2 },
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const tracking = currentLanguage() === 'th' ? undefined : LATIN_TRACKING[type];

  return (
    <Text
      maxFontSizeMultiplier={SCALE_CAP[type]}
      // Break lines at word boundaries like native iOS text; on Android,
      // hyphenate long words rather than cutting them at an arbitrary letter.
      lineBreakStrategyIOS="standard"
      textBreakStrategy="balanced"
      android_hyphenationFrequency="normal"
      style={[
        // Links default to the brand teal; the old fixed blue was 3.2:1 on the light canvas.
        { color: theme[themeColor ?? (type === 'linkPrimary' ? 'tint' : 'text')] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'largeTitle' && styles.largeTitle,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'amount' && styles.amount,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        tracking,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 64,
  },
  /** Screen title (iOS large-title scale). */
  largeTitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 800,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: 700,
  },
  /** Large money figure; tabular digits keep amounts from jittering. */
  amount: {
    fontSize: 34,
    lineHeight: 44,
    fontWeight: 800,
    // Digits and the baht sign only, so tight tracking is safe in Thai too.
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
    lineHeight: 18,
  },
});
