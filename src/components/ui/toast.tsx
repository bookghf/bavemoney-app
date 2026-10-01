import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Spacing } from '@/constants/theme';
import { FontScaleCap } from '@/hooks/use-font-scale';
import { t } from '@/lib/i18n';

type Toast = {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  action?: { label: string; onPress: () => void };
};

type ToastState = {
  current: Toast | null;
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: () => void;
};

const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (toast) => set({ current: { ...toast, id: Date.now() } }),
  dismiss: () => set({ current: null }),
}));

/** Show a short message at the bottom of the screen, optionally with an action such as Undo. */
export const toast = {
  success: (message: string, action?: Toast['action']) => useToastStore.getState().show({ message, tone: 'success', action }),
  error: (message: string) => useToastStore.getState().show({ message, tone: 'error' }),
  info: (message: string) => useToastStore.getState().show({ message, tone: 'info' }),
};

const DURATION_MS = 4000;
const ICONS = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle' } as const;
const COLORS = { success: '#3DD68C', error: '#FF6369', info: '#8AB4FF' };

/** Renders the current toast. Mount once, above the navigator. */
export function ToastHost() {
  const current = useToastStore((state) => state.current);
  const dismiss = useToastStore((state) => state.dismiss);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(dismiss, DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  if (!current) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 96 }]}>
      <Animated.View
        key={current.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={styles.toast}>
        <Ionicons name={ICONS[current.tone]} size={20} color={COLORS[current.tone]} />
        <Text style={styles.message} numberOfLines={3} maxFontSizeMultiplier={FontScaleCap.heading}>
          {current.message}
        </Text>
        {current.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              current.action?.onPress();
              dismiss();
            }}>
            <Text style={styles.action} maxFontSizeMultiplier={FontScaleCap.heading}>
              {current.action.label}
            </Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={t('Dismiss')} hitSlop={10} onPress={dismiss}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: Spacing.three, right: Spacing.three, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 520,
    width: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#1C1F26',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  },
  message: { flex: 1, color: '#ffffff', fontSize: 14, fontWeight: 600 },
  action: { color: '#8AB4FF', fontSize: 14, fontWeight: 700 },
});
