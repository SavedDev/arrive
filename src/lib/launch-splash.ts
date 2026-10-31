import * as SplashScreen from 'expo-splash-screen';

// Arrive decides when the launch screen goes away. Normally that's as soon as the app is
// ready. When a Lock Screen tap launches Arrive to send a check-in, the launch screen stays
// until Messages has slid up over it, so Home never flashes first. (On iOS the launch screen
// is part of the app's root view, and Messages is presented above it.)
void SplashScreen.preventAutoHideAsync().catch(() => {});

let hidden = false;
export function hideSplash() {
  if (hidden) return;
  hidden = true;
  try {
    SplashScreen.hide();
  } catch {
    // Nothing to hide (web, or already gone).
  }
}
// Never leave the launch screen up, whatever else goes wrong.
setTimeout(hideSplash, 5000);
