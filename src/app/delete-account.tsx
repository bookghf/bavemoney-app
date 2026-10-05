import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useExportCSV } from '@/hooks/use-export';
import { useDeleteAccount } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/api/client';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';

/**
 * Permanently delete the login and all its data (App Store guideline
 * 5.1.1(v)). Offers a CSV export first; the password (re-checked by the API)
 * and a final destructive alert guard the delete. Signing out afterwards
 * drops the protected screens, so the app lands on login by itself.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const email = useAuthStore((state) => state.user?.email);
  const remove = useDeleteAccount();
  const exportCSV = useExportCSV();
  const [password, setPassword] = useState('');
  const [showError, setShowError] = useState(false);

  const passwordError = password === '' ? t('Enter your password to confirm') : null;

  const confirm = () => {
    if (passwordError) {
      setShowError(true);
      haptics.warning();
      return;
    }
    haptics.warning();
    Alert.alert(
      t('Delete your account?'),
      t('Your login and all your transactions, accounts, budgets, and categories will be permanently deleted. This can not be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete permanently'),
          style: 'destructive',
          onPress: () =>
            remove.mutate(password, {
              onSuccess: () => {
                haptics.success();
                toast.success(t('Your account was deleted.'));
              },
              onError: () => setPassword(''),
            }),
        },
      ],
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={remove.error} />
          <Button title={t('Delete account')} variant="danger" onPress={confirm} loading={remove.isPending} />
        </>
      }>
      <Card style={[styles.warning, { backgroundColor: theme.dangerSoft }]}>
        <Ionicons name="warning" size={28} color={theme.danger} />
        <ThemedText type="sectionTitle">{t('Delete your account for good')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Your login ({email}) and all your data will be permanently deleted. You will be signed out on this device.', {
            email: email ?? '',
          })}
        </ThemedText>
      </Card>

      <Card style={styles.export}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('Want a copy first? Export your transactions as CSV before you delete.')}
        </ThemedText>
        <Button
          title={exportCSV.isPending ? t('Preparing file…') : t('Export CSV')}
          variant="secondary"
          loading={exportCSV.isPending}
          onPress={() => exportCSV.mutate(undefined, { onError: (error) => toast.error(getErrorMessage(error)) })}
        />
      </Card>

      <TextField
        label={t('Password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        hint={t('Enter your password to confirm')}
        error={showError ? passwordError : null}
        onSubmitEditing={confirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  warning: { gap: Spacing.two },
  export: { gap: Spacing.three },
});
