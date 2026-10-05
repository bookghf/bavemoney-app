import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/ui/chip-select';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { Spacing } from '@/constants/theme';
import { useCurrencies } from '@/hooks/use-accounts';
import { useUpdateProfile } from '@/hooks/use-profile';
import { orderCurrencies } from '@/lib/currency-order';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { displayNameProblem } from '@/lib/validation';
import { useAuthStore } from '@/store/auth-store';

export default function EditProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const currencies = useCurrencies();
  const updateProfile = useUpdateProfile();
  const saving = useRef(false);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [currency, setCurrency] = useState(user?.default_currency ?? 'THB');

  // Ordered by the saved currency, so chips don't move while picking.
  const codes = orderCurrencies(currencies.data?.map((c) => c.code) ?? [currency], user?.default_currency);
  const profileChanged = displayName.trim() !== (user?.display_name ?? '') || currency !== user?.default_currency;

  const nameError = displayNameProblem(displayName);

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  readOnly: { gap: Spacing.one },
});
