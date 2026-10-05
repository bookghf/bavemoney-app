/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F1222',
    /** App canvas; cards sit on it in `surface`. */
    background: '#F3F4F8',
    surface: '#FFFFFF',
    backgroundElement: '#EEF0F5',
    backgroundSelected: '#E2E5EC',
    /** Hairline dividers and card edges; decorative, so it may be faint. */
    border: '#E6E8EE',
    /**
     * Edge of an input (text field, date button, unselected chip). Unlike
     * `border` it must be seen: 3.26:1 on background, 3.59:1 on surface,
     * 3.15:1 on backgroundElement (WCAG 1.4.11 asks 3:1).
     */
    controlBorder: '#828796',
    // 5.38:1 on background, 5.91:1 on surface, 5.18:1 on backgroundElement,
    // 4.69:1 on backgroundSelected, 5.11:1 on tintSoft (AA asks 4.5:1).
    textSecondary: '#5F6472',
    // Brand teal, kept apart from income green so green always means money in.
    // tint is for text and icons; tintFill is a solid background under white
    // text. Both clear WCAG AA (4.5:1) where they are used.
    tint: '#0F766E',
    tintFill: '#0F766E',
    tintSoft: '#E0F2F1',
    // Money colors: income/saving green, spending red, transfers blue.
    success: '#15803D',
    successSoft: '#E3F6EA',
    danger: '#D93036',
    dangerSoft: '#FDE8E8',
    transfer: '#2563EB',
    transferSoft: '#E5EEFD',
    warning: '#B35C00',
    warningSoft: '#FFF1E0',
  },
  dark: {
    text: '#F4F5F8',
    background: '#0B0C10',
    surface: '#17191F',
    backgroundElement: '#22252D',
    backgroundSelected: '#2D313A',
    border: '#262A33',
    // 3.82:1 on background, 3.43:1 on surface, 3.00:1 on backgroundElement.
    controlBorder: '#686E7B',
    // 7.54:1 on background, 6.78:1 on surface, 5.91:1 on backgroundElement,
    // 5.03:1 on backgroundSelected, 4.81:1 on tintSoft.
    textSecondary: '#9BA1AE',
    // In dark mode text needs a lighter teal (11:1 on the canvas) while
    // filled buttons keep a deep one so white labels stay readable (5.5:1).
    tint: '#2DD4BF',
    tintFill: '#0F766E',
    tintSoft: '#123A37',
    success: '#3DD68C',
    successSoft: '#12301F',
    danger: '#FF6369',
    dangerSoft: '#3A1A1C',
    transfer: '#6AA6FF',
    transferSoft: '#1A2A45',
    warning: '#FFB45C',
    warningSoft: '#3A2A12',
  },
} as const;

/** Brand gradient for hero surfaces (balance card, avatar). */
// Starts dark enough that the small white labels on the hero card stay
// above 4.5:1 contrast.
export const BrandGradient = ['#0F766E', '#134E4A'] as const;

/** Soft glow under hero surfaces, matching BrandGradient. */
export const BrandShadow = '0 12px 28px rgba(15, 118, 110, 0.30)';

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Corner radii. Nested shapes subtract the gap between them (e.g. a segment
 * inside a padded track uses `Radius.md - padding`), and circles use `full`.
 */
export const Radius = {
  /** Small marks: swatches, badges, progress bars. */
  sm: 8,
  /** Controls: buttons, text fields, segmented tracks, toasts. */
  md: 14,
  /** Cards, sheets, and the tab bar's top corners. */
  lg: 20,
  /** Pills, chips, and circles. */
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
