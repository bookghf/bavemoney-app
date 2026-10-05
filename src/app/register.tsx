import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/ui/chip-select';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useRegister } from '@/hooks/use-auth';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { openLegalPage, PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { displayNameProblem, passwordProblem } from '@/lib/validation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The currencies the API seeds; the list endpoint needs a session, so the
// sign-up form offers these and the API validates.
const CURRENCIES = ['THB', 'USD', 'EUR'] as const;

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('THB');
  const [showErrors, setShowErrors] = useState(false);
  const register = useRegister();

  const normalizedEmail = email.trim().toLowerCase();
  const emailError = EMAIL_PATTERN.test(normalizedEmail) ? null : t('Enter a valid email address');
  const passwordError = passwordProblem(password);
  const nameError = displayNameProblem(displayName);

  const submit = () => {
    if (emailError || passwordError || nameError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (register.isPending) return;
    register.mutate({
      email: normalizedEmail,
      password,
      display_name: displayName.trim() || undefined,
      default_currency: currency,
    });
  };

  return (
    <Screen
      footer={
        <>
          <ErrorText error={register.error} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.consent}>
            {t('By creating an account you agree to the')}{' '}
            <ThemedText type="small" themeColor="tint" onPress={() => openLegalPage(TERMS_URL)} accessibilityRole="link">
              {t('Terms of use')}
            </ThemedText>{' '}
            {t('and')}{' '}
            <ThemedText type="small" themeColor="tint" onPress={() => openLegalPage(PRIVACY_URL)} accessibilityRole="link">
              {t('Privacy policy')}
            </ThemedText>
          </ThemedText>
          <Button title={t('Create account')} onPress={submit} loading={register.isPending} />
          <Link href="/login" replace style={styles.link}>
            <ThemedText type="linkPrimary">{t('Already have an account? Sign in')}</ThemedText>
          </Link>
        </>
      }>
      <ThemedText type="largeTitle">{t('Create account')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('Track every baht in seconds.')}</ThemedText>

      <TextField
        label={t('Display name')}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder={t('e.g. Somchai')}
        textContentType="name"
        error={showErrors ? nameError : null}
      />
      <TextField
        label={t('Email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        error={showErrors ? emailError : null}
      />
      <TextField
        label={t('Password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t('At least 8 characters')}
        error={showErrors ? passwordError : null}
        onSubmitEditing={submit}
      />
      <ChipSelect
        label={t('Main currency')}
        options={CURRENCIES.map((code) => ({ value: code, label: code }))}
        value={currency}
        onChange={setCurrency}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: 8 },
  consent: { textAlign: 'center' },
});
