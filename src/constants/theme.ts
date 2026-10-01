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
    tint: '#1E6FE8',
    tintSoft: '#E6EFFD',
    success: '#1A7F4B',
    successSoft: '#E3F5EB',
    danger: '#D93036',
    dangerSoft: '#FDE8E8',
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
    // Dark enough for white text on filled buttons (WCAG AA).
    tint: '#2F74E6',
    tintSoft: '#1A2A45',
    success: '#3DD68C',
    successSoft: '#12301F',
    danger: '#FF6369',
    dangerSoft: '#3A1A1C',
    warning: '#FFB45C',
    warningSoft: '#3A2A12',
  },
} as const;

/** Brand gradient for hero surfaces (balance card, avatar). */
export const BrandGradient = ['#2F80ED', '#4B4FD8'] as const;

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
