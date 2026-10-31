import { initializeNotifications } from '@/lib/notifications';
import { syncGeofences } from '@/lib/location';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useApp } from '@/state/app';
import {
  readReminder,
  reconcileReminder,
  subscribeReminder,
  watchActivityButtons,
} from '@/lib/reminder-runtime';
import type { Reminder } from '@/lib/reminder';
import {
  registerPushTokens,
  smartInvitePending,
  syncCheckInSchedule,
  syncSmartRuntime,
} from '@/lib/smart-reminders';
import { needsSmartService, separationTriggerOn } from '@/lib/smart-checkin';
export function Runtime() {
  const { ready, places, presets, people, prefs, setSmartPartner, updatePrefs } = useApp();
  // Keep the Lock Screen reminder's check-in buttons in step with edits.
  useEffect(() => {
    if (ready) void reconcileReminder().catch(() => {});
  }, [ready, presets, people, prefs]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    initializeNotifications();
    const seen = new Set<string>();
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier === 'DISMISS') return;
      const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (seen.has(responseId)) return;
      seen.add(responseId);
      const data = response.notification.request.content.data || {};
      if (typeof data.historyId === 'string') router.push('/history');
      else
        router.push({
          pathname: '/check-in',
          params: {
            preset: typeof data.presetId === 'string' ? data.presetId : '',
            recipient: typeof data.recipientId === 'string' ? data.recipientId : '',
            choose: data.choose === '1' ? '1' : '',
            quick: response.actionIdentifier === 'CHECK_IN' ? '1' : '',
            from: data.reminder === '1' ? 'reminder' : '',
          },
        });
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then(handle);
    const listener = Notifications.addNotificationResponseReceivedListener(handle);
    // expo-widgets throws at import time if the binary lacks its native module
    // (Expo Go, or a dev build made before the plugin was added).
    if (Platform.OS === 'ios' && requireOptionalNativeModule('ExpoWidgets'))
      import('@/widgets/CheckInWidget').then((m) => m.default.updateSnapshot({})).catch(() => {});
    // Match the Lock Screen reminder to local state at launch and on every return to the
    // foreground. This is also when a pending departure reminder gets its Live Activity,
    // because iOS only lets apps start one while they're on screen.
    void reconcileReminder().catch(() => {});
    const stopButtons = watchActivityButtons();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reconcileReminder().catch(() => {});
    });
    // A pending reminder that comes due while Arrive is open starts right on time.
    let due: ReturnType<typeof setTimeout> | undefined;
    const watch = (r: Reminder | null) => {
      clearTimeout(due);
      if (r?.phase === 'scheduled')
        due = setTimeout(
          () => void reconcileReminder().catch(() => {}),
          Math.max(0, r.dueAt - Date.now()) + 500,
        );
    };
    void readReminder().then(watch);
    const unwatch = subscribeReminder(watch);
    return () => {
      listener.remove();
      foreground.remove();
      stopButtons();
      unwatch();
      clearTimeout(due);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    void syncGeofences(places).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncGeofences(places).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [ready, places]);
  // Smart Check-In: either trigger (leaving a remembered place, going separate ways) starts
  // the Live Activity by push, so this phone registers for pushes and shares its active days.
  const separation = separationTriggerOn(prefs);
  const service = needsSmartService(prefs, places);
  const days = prefs.activeDays.join(',');
  useEffect(() => {
    if (!ready || Platform.OS === 'web') return;
    const sync = () => {
      if (service)
        void Promise.allSettled([registerPushTokens(), syncCheckInSchedule(prefs.activeDays)]);
      // Background location runs only while the server confirms the pair. If the other person
      // disconnected, or an invitation expired unscanned, they stay a normal recipient and
      // leaving remembered places and manual check-ins carry on as before.
      void syncSmartRuntime(separation)
        .then(async (state) => {
          if (state !== 'unpaired' || (await smartInvitePending())) return;
          await setSmartPartner(null);
          await updatePrefs({ smartReminders: false });
        })
        .catch(() => {});
    };
    sync();
    let tokenSubscription: { remove(): void } | undefined;
    if (service && Platform.OS === 'ios' && requireOptionalNativeModule('ExpoWidgets'))
      void import('expo-widgets')
        .then((widgets) => {
          tokenSubscription = widgets.addPushToStartTokenListener((event) => {
            void registerPushTokens(event.activityPushToStartToken).catch(() => {});
          });
        })
        .catch(() => {});
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active' && service) sync();
    });
    return () => {
      foreground.remove();
      tokenSubscription?.remove();
    };
    // The app's actions are recreated every render; resyncing on each would poll the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, separation, service, days]);
  return null;
}
