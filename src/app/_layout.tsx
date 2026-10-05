import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { HeaderButton } from '@/components/ui/header-button';
import { ToastHost } from '@/components/ui/toast';
import { Colors } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { AppProviders } from '@/providers/app-providers';
import { useAuthStore } from '@/store/auth-store';
import { usePreferences } from '@/store/preferences-store';

// Keep the native splash up until the persisted session has been restored;
// AnimatedSplashOverlay hides it once it mounts.
SplashScreen.preventAutoHideAsync();

function CancelButton() {
  return <HeaderButton label={t('Cancel')} onPress={() => router.back()} />;
}

function BackButton() {
  return <HeaderButton back label={t('Back')} onPress={() => router.back()} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const prefsHydrated = usePreferences((state) => state.isHydrated);
  // Text and dates are rendered with plain t()/format calls, so remount the
  // screens when the language or calendar changes.
  const localeKey = usePreferences((state) => `${state.language ?? 'auto'}-${state.calendar}`);

  useEffect(() => {
    useAuthStore.getState().hydrate();
    usePreferences.getState().hydrate();
  }, []);

  // Render no routes until we know whether a session exists, so protected
  // screens never flash (and never fire requests) for signed-out users.
  if (!isHydrated || !prefsHydrated) return null;

  // Headers blend into the gray canvas instead of sitting on a white bar.
  const header = {
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTintColor: colors.tint,
    headerTitleStyle: { color: colors.text },
  };
  const modal = { ...header, presentation: 'modal' as const, headerShown: true, headerLeft: CancelButton };
  const pushed = { ...header, headerShown: true, headerLeft: BackButton };

  return (
    <AppProviders>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack key={localeKey} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          {/* Signed in: the tab app plus modal forms. */}
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="transactions"
              options={{ ...pushed, title: t('Transactions') }}
            />
            <Stack.Screen name="categories" options={{ ...pushed, title: t('Categories') }} />
            <Stack.Screen
              name="budgets"
              options={{ ...pushed, title: t('Budgets') }}
            />
            <Stack.Screen name="recurring" options={{ ...pushed, title: t('Recurring') }} />
            <Stack.Screen name="add-transaction" options={{ ...modal, title: t('Add transaction') }} />
            <Stack.Screen name="transaction/[id]" options={{ ...modal, title: t('Edit transaction') }} />
            <Stack.Screen name="add-account" options={{ ...modal, title: t('New account') }} />
            <Stack.Screen name="edit-account" options={{ ...modal, title: t('Edit account') }} />
            <Stack.Screen name="add-budget" options={{ ...modal, title: t('New budget') }} />
            <Stack.Screen name="recurring-form" options={{ ...modal, title: t('Recurring item') }} />
            <Stack.Screen name="edit-profile" options={{ ...modal, title: t('Edit profile') }} />
            <Stack.Screen name="reset-account" options={{ ...modal, title: t('Reset account') }} />
            <Stack.Screen name="delete-account" options={{ ...modal, title: t('Delete account') }} />
            <Stack.Screen name="category-form" options={{ ...modal, title: t('Category') }} />
            <Stack.Screen name="import" options={{ ...modal, title: t('Import CSV') }} />
          </Stack.Protected>

          {/* Signed out: auth screens only. Stack.Protected redirects to the
              first available screen when a guard flips. */}
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="forgot-password" />
          </Stack.Protected>
        </Stack>
        <ToastHost />
        <AnimatedSplashOverlay />
      </ThemeProvider>
    </AppProviders>
  );
}
