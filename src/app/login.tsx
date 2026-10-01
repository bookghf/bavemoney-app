import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useLogin } from '@/hooks/use-auth';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const login = useLogin();

  const emailError = email.trim() === '' ? t('Enter your email') : null;
  const passwordError = password === '' ? t('Enter your password') : null;

  const submit = () => {
    if (emailError || passwordError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (login.isPending) return;
    // On success the auth store flips and Stack.Protected swaps in the tabs.
    login.mutate({ email: email.trim().toLowerCase(), password });
  };

  return (
    <Screen
      footer={
        <>
          <ErrorText error={login.error} />
          <Button title={t('Sign in')} onPress={submit} loading={login.isPending} />
          <Link href="/register" replace style={styles.link}>
            <ThemedText type="linkPrimary">{t('No account yet? Create one')}</ThemedText>
          </Link>
        </>
      }>
      <ThemedText type="largeTitle">{t('Sign in')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('Welcome back to your ledger.')}</ThemedText>

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
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
        error={showErrors ? passwordError : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: 8 },
});
