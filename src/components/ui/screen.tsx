import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  /** Adds bottom padding for the tab bar (tab screens only). */
  inTabs?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned below the scrolling content and above the keyboard, e.g. a Save button. */
  footer?: ReactNode;
  /**
   * Called when the user scrolls within END_THRESHOLD of the bottom, e.g. to
   * load the next page. It can fire on several scroll events in a row, so the
   * caller must ignore calls while a load is already running.
   */
  onEndReached?: () => void;
}>;

/** Distance from the bottom (pt) at which onEndReached fires. */
const END_THRESHOLD = 400;

/**
 * Scrollable, centered, max-width page container shared by the app screens.
 * It moves out of the keyboard's way and dismisses the keyboard on drag.
 */
export function Screen({ children, inTabs, edges, refreshing, onRefresh, footer, onEndReached }: ScreenProps) {
  const handleScroll = onEndReached
    ? ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - END_THRESHOLD) onEndReached();
      }
    : undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={edges}>
        <KeyboardAvoidingView
          style={styles.safeArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' && !inTabs ? 64 : 0}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={handleScroll}
            scrollEventThrottle={handleScroll ? 100 : undefined}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: (inTabs ? BottomTabInset : 0) + Spacing.four },
            ]}
            refreshControl={
              onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
            }>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
});
