import { useWindowDimensions } from 'react-native';

/**
 * How far the device's text size setting (iOS Dynamic Type, Android font
 * size) can grow each kind of text. Everything follows the setting; the caps
 * only stop the largest accessibility sizes from breaking layouts, and big
 * text such as amounts already starts large, so it grows the least.
 */
export const FontScaleCap = {
  /** Hero amounts and screen titles (already 32–40pt). */
  display: 1.3,
  /** Section headings and app chrome such as menus and toasts. */
  heading: 1.6,
  /** Body text, labels, and form inputs. */
  body: 2,
} as const;

/** Above this scale, side-by-side rows stack vertically. */
const LARGE_TEXT = 1.35;

/** The current text scale and whether layouts should switch to their stacked form. */
export function useFontScale() {
  const { fontScale } = useWindowDimensions();
  return { fontScale, isLargeText: fontScale >= LARGE_TEXT };
}
