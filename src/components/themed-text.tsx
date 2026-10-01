import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';

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

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      maxFontSizeMultiplier={SCALE_CAP[type]}
      style={[
        { color: theme[themeColor ?? 'text'] },
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
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  /** Screen title (iOS large-title scale). */
  largeTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: 800,
    letterSpacing: -0.6,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
    letterSpacing: -0.2,
  },
  /** Large money figure; tabular digits keep amounts from jittering. */
  amount: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: 800,
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
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
