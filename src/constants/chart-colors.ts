/**
 * Chart colors. Categorical slots are assigned in this fixed order (validated
 * for color-vision deficiency on adjacent pairs) and never cycled: an entity
 * past slot 8 — and the "Uncategorized"/"Other" buckets — get the neutral.
 * Dark mode uses the same hues stepped for the dark surface.
 */
export const ChartColors = {
  light: {
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    neutral: '#a3a29b',
    track: '#e7e6e1',
  },
  dark: {
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    neutral: '#6f6e68',
    track: '#2e2e2b',
  },
} as const;

export type ChartPalette = (typeof ChartColors)['light' | 'dark'];

/** Color for the entity at `slot` in its stable order (-1 = neutral bucket). */
export function seriesColor(palette: ChartPalette, slot: number): string {
  return slot >= 0 && slot < palette.series.length ? palette.series[slot] : palette.neutral;
}
