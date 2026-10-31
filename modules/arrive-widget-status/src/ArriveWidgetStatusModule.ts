import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type WidgetStatusModule = { isConfigured(): Promise<boolean> };
const nativeModule = requireOptionalNativeModule<WidgetStatusModule>('ArriveWidgetStatus');

export async function isArriveWidgetConfigured() {
  if (Platform.OS !== 'ios' || !nativeModule) return false;
  try {
    return await nativeModule.isConfigured();
  } catch {
    return false;
  }
}
