import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipSelect } from '@/components/ui/chip-select';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useCurrencies } from '@/hooks/use-accounts';
import { useChangePassword, useUpdateProfile } from '@/hooks/use-profile';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { displayNameProblem, passwordProblem } from '@/lib/validation';
import { useAuthStore } from '@/store/auth-store';


export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const currencies = useCurrencies();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const saving = useRef(false);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [currency, setCurrency] = useState(user?.default_currency ?? 'THB');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordErrors, setShowPasswordErrors] = useState(false);

  const codes = currencies.data?.map((c) => c.code) ?? [currency];
  const profileChanged = displayName.trim() !== (user?.display_name ?? '') || currency !== user?.default_currency;

  const currentError = currentPassword === '' ? t('Enter your current password') : null;
  const newError = passwordProblem(newPassword);
  const nameError = displayNameProblem(displayName);
  const confirmError = confirmPassword !== newPassword ? t('Passwords do not match') : null;

  const saveProfile = () => {
    if (nameError) {
      haptics.warning();
      return;
    }
    if (!profileChanged) {
      router.back();
      return;
    }
    if (saving.current) return;
    saving.current = true;
    updateProfile.mutate(
      { display_name: displayName.trim(), default_currency: currency },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('Profile updated'));
          router.back();
        },
        onSettled: () => {
          saving.current = false;
        },
      },
    );
  };

  const savePassword = () => {
    if (currentError || newError || confirmError) {
      setShowPasswordErrors(true);
      haptics.warning();
      return;
    }
    changePassword.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('Password changed. Other devices were signed out.'));
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setShowPasswordErrors(false);
        },
      },
    );
  };

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <ErrorText error={updateProfile.error} />
          <Button title={t('Save changes')} onPress={saveProfile} loading={updateProfile.isPending} />
        </>
      }>
      <TextField
        label={t('Display name')}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder={t('e.g. Somchai')}
        textContentType="name"
        // No maxLength: it counts emoji twice; the rule below counts characters.
        error={nameError}
      />
      <View style={styles.readOnly}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('Email')}
        </ThemedText>
        <ThemedText>{user?.email}</ThemedText>
      </View>
      <ChipSelect
        label={t('Main currency')}
        options={codes.map((code) => ({ value: code, label: code }))}
        value={currency}
        onChange={setCurrency}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {t('Used for your Home totals and reports. Existing accounts keep their own currency.')}
      </ThemedText>

      <Card style={styles.password}>
        <ThemedText type="sectionTitle">{t('Change password')}</ThemedText>
        <TextField
          label={t('Current password')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          error={showPasswordErrors ? currentError : null}
        />
        <TextField
          label={t('New password')}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          hint={t('At least 8 characters')}
          error={showPasswordErrors ? newError : null}
        />
        <TextField
          label={t('Confirm new password')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={savePassword}
          error={showPasswordErrors ? confirmError : null}
        />
        <ErrorText error={changePassword.error} />
        <Button
          title={t('Change password')}
          variant="secondary"
          onPress={savePassword}
          loading={changePassword.isPending}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readOnly: { gap: Spacing.one },
  password: { gap: Spacing.three, marginTop: Spacing.three },
});
