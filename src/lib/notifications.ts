import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { HistoryEntry, Preferences } from './types';
export function initializeNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  void Notifications.setNotificationCategoryAsync('ARRIVAL', [
    // iOS cannot send a text from a notification, so this opens straight into the composer.
    {
      identifier: 'CHECK_IN',
      buttonTitle: 'Send check-in',
      options: { opensAppToForeground: true },
    },
    { identifier: 'DISMISS', buttonTitle: 'Dismiss', options: { opensAppToForeground: false } },
  ]);
}
export async function enableNotifications() {
  if (Platform.OS === 'web')
    throw new Error('Local notifications are available in the iOS and Android app.');
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('check-ins', {
      name: 'Check-ins',
      // Exported by expo-notifications (and type-checked), but ESLint's import plugin can't
      // read the enum from the package's SDK 58 build output.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  if (!(await Notifications.requestPermissionsAsync()).granted)
    throw new Error(
      'Notifications are off. Enable them in phone settings when you want reminders. Manual check-ins still work.',
    );
}
export async function localNotice(
  title: string,
  body: string,
  data: Record<string, string> = {},
  seconds?: number,
  identifier?: string,
) {
  if (Platform.OS === 'web') return '';
  if (!(await Notifications.getPermissionsAsync()).granted) return '';
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      data,
      categoryIdentifier: data.historyId ? undefined : 'ARRIVAL',
      sound: false,
    },
    trigger: seconds
      ? {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
          channelId: 'check-ins',
        }
      : Platform.OS === 'android'
        ? { channelId: 'check-ins' }
        : null,
  });
}
export async function cancelReminders() {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === 'departure')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
export async function confirmSend(entry: HistoryEntry, prefs: Preferences) {
  if (entry.status !== 'sent') return;
  await cancelReminders();
  if (!prefs.confirmations) return;
  await localNotice(
    'Check-in sent! ✓',
    'Messages reported a send action. Delivery is not verified.',
    { historyId: entry.id },
    undefined,
    `sent-${entry.id}`,
  );
}
export async function clearNotifications() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}
