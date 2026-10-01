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
    border: '#E6E8EE',
    textSecondary: '#6B7080',
    // Brand green: dark enough for white text on filled buttons (WCAG AA).
    tint: '#15803D',
    tintSoft: '#E3F6EA',
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
    textSecondary: '#9BA1AE',
    // Readable as text on the dark canvas and under white button labels.
    tint: '#178A47',
    tintSoft: '#12301F',
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
export const BrandGradient = ['#22A55E', '#0E6E44'] as const;

/** Soft glow under hero surfaces, matching BrandGradient. */
export const BrandShadow = '0 12px 28px rgba(14, 110, 68, 0.30)';

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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
