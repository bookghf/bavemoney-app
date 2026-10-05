import { router } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useChangePassword } from '@/hooks/use-profile';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { passwordProblem } from '@/lib/validation';

/**
 * Change the password on its own screen, so its single button can only mean
 * one thing. The API signs out other devices and returns a fresh session.
 */
export default function ChangePasswordScreen() {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const currentError = currentPassword === '' ? t('Enter your current password') : null;
  const newError = passwordProblem(newPassword);
  const confirmError = confirmPassword !== newPassword ? t('Passwords do not match') : null;

  const save = () => {
    if (currentError || newError || confirmError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (changePassword.isPending) return;
    changePassword.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('Password changed. Other devices were signed out.'));
          router.back();
        },
      },
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={changePassword.error} />
          <Button title={t('Change password')} onPress={save} loading={changePassword.isPending} />
        </>
      }>
      <ThemedText type="small" themeColor="textSecondary">
        {t('Other devices will be signed out. You stay signed in here.')}
      </ThemedText>
      <TextField
        label={t('Current password')}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={showErrors ? currentError : null}
      />
      <TextField
        label={t('New password')}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t('At least 8 characters')}
        error={showErrors ? newError : null}
      />
      <TextField
        label={t('Confirm new password')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={save}
        error={showErrors ? confirmError : null}
      />
    </Screen>
  );
}
