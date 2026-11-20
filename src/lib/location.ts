import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { errorMessage } from './domain';
import { hasAccessCached } from './access';
import { read, write } from './storage';
import { initialPreferences, type Place, type Visit } from './types';
import { enableNotifications, localNotice } from './notifications';
import { activeOn, departureTriggerOn, separationTriggerOn } from './smart-checkin';
import {
  ANCHOR_LIFETIME_MS,
  ANCHOR_REGION,
  acceptableFix,
  anchorExitCounts,
  anchorRadius,
  insideRememberedPlace,
  type Anchor,
} from './anchor';
import {
  DEPARTURE_TITLE,
  departureBodyFor,
  cancelScheduledReminder,
  scheduleDepartureReminder,
} from './reminder-runtime';
import { uploadUsefulLocation } from './smart-reminders';
const TASK = 'arrive-geofence-v1';
let events: Promise<void> = Promise.resolve();
// A remembered place's geofence is one of Smart Check-In's two triggers: leaving it (after a
// real stay) starts the same Live Activity that going separate ways does. Arriving only
// withdraws a departure that hasn't shown yet; it no longer sends its own notification.
async function handleEvent(
  eventType: Location.GeofencingEventType,
  region: Location.LocationRegion,
) {
  // Smart Check-In is part of Arrive Plus; without it, leaving places starts nothing.
  if (!(await hasAccessCached())) return;
  const places = await read<Place[]>('places', []),
    prefs = { ...initialPreferences, ...(await read('preferences', initialPreferences)) };
  if (region.identifier === ANCHOR_REGION) return handleAnchorEvent(eventType, places, prefs);
  const place = places.find((p) => p.id === region.identifier && p.enabled);
  if (!place) return;
  const key = `visit:${place.id}`,
    previous = await read<Visit | null>(key, null),
    now = Date.now();
  // Going separate ways is judged on the server from both phones' latest locations; a
  // geofence crossing is a good moment to refresh this phone's.
  if (separationTriggerOn(prefs))
    await uploadUsefulLocation(
      eventType === Location.GeofencingEventType.Exit ? 'geofenceExit' : 'foreground',
      true,
    ).catch((e) => write('smart-reminders-error', errorMessage(e)));
  if (eventType === Location.GeofencingEventType.Exit) {
    if (previous && !previous.inside) return;
    const visit: Visit = {
      inside: false,
      exitedAt: now,
      lastAction: previous?.lastAction || 0,
      visitId: previous?.visitId || Crypto.randomUUID(),
    };
    // Only a confirmed stay followed by an exit counts, so GPS jitter at the edge doesn't.
    if (previous?.inside && departureTriggerOn(prefs, places) && activeOn(prefs, now))
      visit.reminderId = await scheduleDepartureReminder({
        visitId: visit.visitId,
        placeId: place.id,
        placeName: place.name,
        recipientId: place.recipientId || prefs.defaultRecipient,
        delayMinutes: prefs.reminderMinutes,
      });
    await write(key, visit);
    return;
  }
  // Back before the delay ran out: the departure never shows.
  if (previous?.reminderId)
    await Notifications.cancelScheduledNotificationAsync(previous.reminderId).catch(() => {});
  await cancelScheduledReminder(place.id);
  if (previous?.inside) return;
  await write(key, {
    inside: true,
    exitedAt: previous?.exitedAt || 0,
    lastAction: previous?.lastAction || 0,
    visitId: Crypto.randomUUID(),
  } satisfies Visit);
}
// ---- Temporary Check-In Anchor -------------------------------------------------------------

const ANCHOR_KEY = 'checkin-anchor';
export const readAnchor = () => read<Anchor | null>(ANCHOR_KEY, null);
/** The anchor worth watching right now, if any. */
async function liveAnchor(now = Date.now()) {
  const anchor = await readAnchor();
  return anchor && !anchor.exitedAt && now - anchor.createdAt <= ANCHOR_LIFETIME_MS ? anchor : null;
}

/**
 * Leaving the spot you last checked in from is a Smart Check-In trigger like any other, with
 * the same switch, days and delay. Its Smart Check-In also offers "Coming".
 */
async function handleAnchorEvent(
  eventType: Location.GeofencingEventType,
  places: Place[],
  prefs: typeof initialPreferences,
) {
  if (eventType !== Location.GeofencingEventType.Exit) return;
  const anchor = await readAnchor(),
    now = Date.now();
  // Once per anchor: iOS can repeat an exit, and drift right after checking in isn't leaving.
  if (!anchor || !anchorExitCounts(anchor, now)) return;
  await write(ANCHOR_KEY, { ...anchor, exitedAt: now } satisfies Anchor);
  if (separationTriggerOn(prefs))
    await uploadUsefulLocation('geofenceExit', true).catch((e) =>
      write('smart-reminders-error', errorMessage(e)),
    );
  if (departureTriggerOn(prefs, [{ enabled: true }]) && activeOn(prefs, now))
    await scheduleDepartureReminder({
      visitId: `anchor-${anchor.id}`,
      placeId: ANCHOR_REGION,
      placeName: '',
      recipientId: prefs.defaultRecipient,
      delayMinutes: prefs.reminderMinutes,
      coming: true,
    });
  // The anchor has done its job; stop watching it.
  await syncGeofences(places).catch(() => {});
}

/**
 * After a sent arrival check-in: where you are now becomes the one temporary anchor,
 * replacing any earlier one. Needs Always location and a good fix, and isn't made inside a
 * remembered place, which already watches for you leaving. Nothing is kept but this one spot.
 */
export async function anchorHere(places: Place[]) {
  if (Platform.OS === 'web') return;
  // Replaced either way: the previous spot is no longer where you are.
  await write(ANCHOR_KEY, null);
  if (!(await Location.getBackgroundPermissionsAsync()).granted) return syncGeofences(places);
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  }).catch(() => null);
  const accuracy = position?.coords.accuracy;
  if (!position || !acceptableFix(accuracy)) return syncGeofences(places);
  const at = { latitude: position.coords.latitude, longitude: position.coords.longitude };
  const radius = anchorRadius(accuracy as number);
  if (!insideRememberedPlace(at, radius, places))
    await write(ANCHOR_KEY, {
      id: Crypto.randomUUID(),
      ...at,
      radius,
      createdAt: Date.now(),
    } satisfies Anchor);
  await syncGeofences(places);
}
/** "Coming" was sent: you've left for home, so the old spot is finished. No new anchor. */
export async function clearAnchor(places: Place[]) {
  await write(ANCHOR_KEY, null);
  await syncGeofences(places).catch(() => {});
}

if (Platform.OS !== 'web')
  TaskManager.defineTask<{
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  }>(TASK, ({ data, error }) => {
    events = events
      .catch(() => {})
      .then(async () => {
        if (error) {
          await write('monitoring-error', error.message);
          return;
        }
        if (data) await handleEvent(data.eventType, data.region);
      })
      .catch(async (e) => {
        await write('monitoring-error', errorMessage(e));
      });
    return events;
  });
export async function requestMonitoring() {
  if (Platform.OS === 'web')
    throw new Error(
      'Remembering places in the background needs the iOS or Android app. You can save this place without it.',
    );
  // Expo Go ships without Arrive's background-location Info.plist keys, so iOS rejects the
  // request with ERR_LOCATION_INFO_PLIST. Say so plainly instead of showing the raw code.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient)
    throw new Error(
      'Expo Go can’t monitor places in the background. Save with monitoring off, or use an Arrive development build to turn it on.',
    );
  if (!(await Location.requestForegroundPermissionsAsync()).granted)
    throw new Error('Enable location access in phone settings to monitor this place.');
  await enableNotifications();
  let background: Location.PermissionResponse;
  try {
    background = await Location.requestBackgroundPermissionsAsync();
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && String(e.code).includes('INFO_PLIST'))
      throw new Error(
        'This build of Arrive is missing background location setup. Rebuild the app, then try again.',
      );
    throw e;
  }
  if (!background.granted)
    throw new Error(
      'Choose Always Allow location access in phone settings so Arrive can notice when you leave.',
    );
}
export async function syncGeofences(places: Place[]) {
  if (Platform.OS === 'web') return;
  const enabled = places.filter((p) => p.enabled);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (n) =>
          n.content.data?.kind === 'departure' &&
          !places.some((p) => p.id === n.content.data?.placeId && p.enabled),
      )
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (enabled.length > 20)
    throw new Error(
      'At most 20 locations can be monitored. Disable a location before adding another.',
    );
  // iOS watches at most 20 regions, so the anchor only fits beside 19 remembered places.
  const anchor = enabled.length < 20 ? await liveAnchor() : null;
  if (!(await Location.getBackgroundPermissionsAsync()).granted || (!enabled.length && !anchor)) {
    if (await Location.hasStartedGeofencingAsync(TASK)) await Location.stopGeofencingAsync(TASK);
    await write('regions-signature', '');
    return;
  }
  const regions = [
    ...enabled.map((p) => ({
      identifier: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: p.radius,
      notifyOnEnter: true,
      notifyOnExit: true,
    })),
    ...(anchor
      ? [
          {
            identifier: ANCHOR_REGION,
            latitude: anchor.latitude,
            longitude: anchor.longitude,
            radius: anchor.radius,
            notifyOnEnter: false,
            notifyOnExit: true,
          },
        ]
      : []),
  ];
  const signature = JSON.stringify(regions);
  if (
    (await Location.hasStartedGeofencingAsync(TASK)) &&
    (await read('regions-signature', '')) === signature
  )
    return;
  await Location.startGeofencingAsync(TASK, regions);
  await write('regions-signature', signature);
  await write('monitoring-error', '');
}
export async function stopMonitoring() {
  if (Platform.OS !== 'web' && (await Location.hasStartedGeofencingAsync(TASK)))
    await Location.stopGeofencingAsync(TASK);
  await events;
}
export async function monitoringStatus() {
  if (Platform.OS === 'web')
    return 'Saved on this browser. Background monitoring is available in the mobile app.';
  if (!(await Location.getBackgroundPermissionsAsync()).granted)
    return 'Monitoring is off: Always Allow location permission is required.';
  const error = await read('monitoring-error', '');
  if (error) return `Monitoring needs attention: ${error}`;
  return (await Location.hasStartedGeofencingAsync(TASK))
    ? 'Remembering your places · up to 20. Your phone may take a few minutes to notice you’ve left.'
    : 'No places are currently being monitored.';
}

// Dev testing: schedules the same departure notification a real geofence exit would,
// after a short delay so there is time to lock the phone. It uses its own kind so
// syncGeofences and cancelReminders never cancel it.
export async function testDepartureReminder(recipientId: string, seconds = 10) {
  await enableNotifications();
  await Notifications.cancelScheduledNotificationAsync('departure-test').catch(() => {});
  const id = await localNotice(
    DEPARTURE_TITLE,
    await departureBodyFor(recipientId),
    { kind: 'departure-test', recipientId },
    seconds,
    'departure-test',
  );
  if (!id) throw new Error('Notifications are off. Enable them to test the reminder.');
}

export async function markManualArrival(presetId: string) {
  const places = await read<Place[]>('places', []);
  for (const p of places.filter((p) => p.presetId === presetId)) {
    const key = `visit:${p.id}`;
    const previous = await read<Visit | null>(key, null);
    await write(key, {
      inside: previous?.inside || false,
      exitedAt: previous?.exitedAt || 0,
      visitId: previous?.visitId || Crypto.randomUUID(),
      lastAction: Date.now(),
    });
  }
}
