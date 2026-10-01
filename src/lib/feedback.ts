import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics are a nicety: never let a failure (web, old devices) surface.
const quietly = (run: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  run().catch(() => {});
};

export const haptics = {
  /** A save or other completed action. */
  success: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A destructive or blocked action. */
  warning: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Picking an option: chips, tabs, segments. */
  selection: () => quietly(() => Haptics.selectionAsync()),
  /** Opening a menu or pressing a prominent button. */
  tap: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
};
