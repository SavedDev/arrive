import '@/lib/location';
import { hideSplash } from '@/lib/launch-splash';
import { sendRequestedAtLaunch } from '@/lib/send-request';
import { useAccess } from '@/lib/access';
import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { AppProvider, useApp } from '@/state/app';
import { Notice } from '@/components/ui';
import { Runtime } from '@/components/runtime';
// Configuration screens slide up as sheets. iOS animates modals natively;
// Android needs the slide set explicitly.
const SHEETS = [
  'history',
  'locations',
  'location',
  'map',
  'preset',
  'icons',
  'people',
  'person',
  'scan',
  'share-qr',
  'subscription',
  'widget',
  'privacy',
  'help',
];
const sheet = {
  presentation: 'modal',
  animation: Platform.OS === 'ios' ? 'default' : 'slide_from_bottom',
} as const;
const settingsSheet =
  Platform.OS === 'web'
    ? sheet
    : ({
        presentation: 'transparentModal',
        animation: 'none',
        gestureEnabled: false,
        contentStyle: { backgroundColor: 'transparent' },
      } as const);
// Links that open a screen directly (the widget, notifications) still get Home underneath.
export const unstable_settings = { initialRouteName: 'index' };
/** Screens that still open without Arrive Plus: the paywall itself, and onboarding. */
const OPEN_WITHOUT_PLUS = ['/paywall', '/welcome'];
function Navigation({ fontsReady }: { fontsReady: boolean }) {
  const app = useApp();
  const { colors, isDark, error } = app;
  const ready = app.ready && fontsReady;
  const access = useAccess();
  const pathname = usePathname();
  // Once set up, Arrive needs Arrive Plus (a free trial or a subscription). Without it, every
  // screen and every Lock Screen or notification link leads to the paywall.
  const locked = ready && app.prefs.onboardingDone && access === 'none';
  useEffect(() => {
    if (locked && !OPEN_WITHOUT_PLUS.includes(pathname)) router.replace('/paywall');
  }, [locked, pathname]);
  // Launched to send a check-in: Home hides the launch screen once Messages is up. Otherwise
  // it hides once Arrive knows whether Plus is active, so Home never flashes before the paywall.
  const known = !app.prefs.onboardingDone || access !== 'checking';
  useEffect(() => {
    if (error || (ready && known && !sendRequestedAtLaunch())) hideSplash();
  }, [ready, known, error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!ready ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: 25 }}>
          {error ? <Notice text={error} error /> : <ActivityIndicator color={colors.green} />}
        </View>
      ) : (
        <>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="settings/index" />
            {SHEETS.map((name) => (
              <Stack.Screen key={name} name={name} options={sheet} />
            ))}
            <Stack.Screen name="settings/[section]" options={settingsSheet} />
            <Stack.Screen name="reminder" options={{ animation: 'fade' }} />
            {/* No swipe away: Arrive Plus is needed to go further. */}
            <Stack.Screen name="paywall" options={{ animation: 'fade', gestureEnabled: false }} />
            {/* Forwards old check-in links to Home; never visible for more than a frame. */}
            <Stack.Screen name="check-in" options={{ animation: 'none' }} />
          </Stack>
          <Runtime />
        </>
      )}
    </View>
  );
}
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  // Fonts load while AppProvider reads saved data, instead of one after the other.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AppProvider>
          <Navigation fontsReady={loaded || !!error} />
        </AppProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
