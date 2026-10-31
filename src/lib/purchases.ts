import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
let configured = false;
export async function purchases() {
  if (Platform.OS === 'web')
    throw new Error('Subscriptions are available through the iOS and Android app stores.');
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!key)
    throw new Error('Subscriptions aren’t available in this build yet. No purchase has been made.');
  if (!configured) {
    Purchases.configure({ apiKey: key });
    configured = true;
  }
  return Purchases;
}
export const entitlement = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'arrive_plus';
