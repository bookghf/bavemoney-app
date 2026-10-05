import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/components/ui/query-state';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { toast } from '@/components/ui/toast';
import { useForgotPassword, useResetPassword } from '@/hooks/use-auth';
import { haptics } from '@/lib/feedback';
import { t } from '@/lib/i18n';
import { passwordProblem } from '@/lib/validation';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;
// The API sends at most one code a minute per account.
const RESEND_SECONDS = 60;

/**
 * Forgot password in two steps on one screen: email → 6-digit code + new
 * password. A successful reset signs in, and Stack.Protected swaps in the tabs.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [showErrors, setShowErrors] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const forgot = useForgotPassword();
  const reset = useResetPassword();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const normalizedEmail = email.trim().toLowerCase();
  const emailError = EMAIL_PATTERN.test(normalizedEmail) ? null : t('Enter a valid email address');
  const codeError = CODE_PATTERN.test(code) ? null : t('Enter the 6-digit code');
  const passwordError = passwordProblem(password);

  const sendCode = (again = false) => {
    if (emailError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (forgot.isPending) return;
    forgot.mutate(normalizedEmail, {
      onSuccess: () => {
        setStep('code');
        setShowErrors(false);
        setResendIn(RESEND_SECONDS);
        if (again) toast.success(t('New code sent'));
      },
    });
  };

  const submit = () => {
    if (codeError || passwordError) {
      setShowErrors(true);
      haptics.warning();
      return;
    }
    if (reset.isPending) return;
    reset.mutate(
      { email: normalizedEmail, code, new_password: password },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('Password reset. You are signed in.'));
        },
        onError: () => setCode(''),
      },
    );
  };

  if (step === 'email') {
    return (
      <Screen
        footer={
          <>
            <ErrorText error={forgot.error} />
            <Button title={t('Send code')} onPress={() => sendCode()} loading={forgot.isPending} />
            <Button title={t('Back to sign in')} variant="quiet" onPress={() => router.back()} />
          </>
        }>
        <ThemedText type="largeTitle">{t('Forgot password?')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('Enter your email and we will send you a 6-digit code.')}</ThemedText>
        <TextField
          label={t('Email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          onSubmitEditing={() => sendCode()}
          error={showErrors ? emailError : null}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <ErrorText error={reset.error ?? forgot.error} />
          <Button title={t('Set new password')} onPress={submit} loading={reset.isPending} />
          <View style={styles.row}>
            <Button
              title={resendIn > 0 ? `${t('Send a new code')} (${resendIn})` : t('Send a new code')}
              variant="quiet"
              disabled={resendIn > 0}
              loading={forgot.isPending}
              onPress={() => sendCode(true)}
              style={styles.flex}
            />
            <Button title={t('Use a different email')} variant="quiet" onPress={() => setStep('email')} style={styles.flex} />
          </View>
        </>
      }>
      <ThemedText type="largeTitle">{t('Reset password')}</ThemedText>
      <ThemedText themeColor="textSecondary">
        {t('If {email} has an account, we sent a 6-digit code to it. It expires in 15 minutes.', { email: normalizedEmail })}
      </ThemedText>
      <TextField
        label={t('Code')}
        value={code}
        onChangeText={(next) => setCode(next.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        placeholder="123456"
        maxLength={6}
        error={showErrors ? codeError : null}
      />
      <TextField
        label={t('New password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
        error={showErrors ? passwordError : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
