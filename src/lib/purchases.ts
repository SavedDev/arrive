import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
let configured = false;
export async function purchases() {
  if (Platform.OS === 'web')
    throw new Error('Subscriptions are available through the iOS and Android app stores.');
  // Development builds use RevenueCat's Test Store when its key is set; release builds always
  // use the store's own key. RevenueCat closes a release build that starts with a Test Store
  // key, so one that slipped into a release build is refused here instead.
  const storeKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  const key = (__DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY) || storeKey;
  if (!key || (!__DEV__ && key.startsWith('test_')))
    throw new Error('Subscriptions aren’t available in this build yet. No purchase has been made.');
  if (!configured) {
    Purchases.configure({ apiKey: key });
    configured = true;
  }
  return Purchases;
}
export const entitlement = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'arrive_plus';
