import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/api/client';
import { t } from '@/lib/i18n';

type QueryStateProps = {
  isPending: boolean;
  error: unknown;
  onRetry?: () => void;
};

/**
 * Renders a spinner while loading, or an error with a retry button.
 * Returns null once data is available so the caller renders its content.
 */
export function QueryState({ isPending, error, onRetry }: QueryStateProps) {
  if (error) {
    return (
      <View style={styles.box}>
        <ThemedText type="small" themeColor="danger">
          {getErrorMessage(error)}
        </ThemedText>
        {onRetry ? <Button title={t('Retry')} variant="secondary" onPress={onRetry} /> : null}
      </View>
    );
  }
  if (isPending) {
    return (
      <View style={styles.box}>
        <ActivityIndicator />
      </View>
    );
  }
  return null;
}

/** Inline error message for forms/mutations. */
export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <ThemedText type="small" themeColor="danger">
      {getErrorMessage(error)}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: Spacing.three, gap: Spacing.two, alignItems: 'flex-start' },
});
