import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Crypto from 'expo-crypto';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { errorMessage } from './domain';
import { hasAccessCached } from './access';
import { read, write } from './storage';
import {
  initialPreferences,
  initialPresets,
  type Person,
  type Place,
  type Preset,
  type Visit,
} from './types';
import { enableNotifications, localNotice } from './notifications';
import {
  activeOn,
  departureTriggerOn,
  madeItAsked,
  madeItDue,
  madeItNotice,
  nextStillNudge,
  separationTriggerOn,
  ARRIVAL_DWELL_MS,
  MONITORING_SETTLE_MS,
  arrivalDecision,
  arrivalNotice,
  type ArrivalNotice,
  type MadeItWatch,
} from './smart-checkin';
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
  highlightArrival,
  readReminder,
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
  if (!(await hasAccessCached())) {
    // Said in Settings, so a missed reminder isn't a mystery.
    await write(
      'smart-reminders-error',
      'Left a place, but Arrive Plus wasn’t confirmed, so nothing started. Opening Arrive rechecks it.',
    );
    return;
  }
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
    // Left before the short stay was up: just passing by, so no arrival notification.
    await cancelArrivalNotice(place.id);
    return;
  }
  // Back before the delay ran out: the departure never shows.
  if (previous?.reminderId)
    await Notifications.cancelScheduledNotificationAsync(previous.reminderId).catch(() => {});
  await cancelScheduledReminder(place.id);
  if (previous?.inside) return;
  await arrivedAt(place, prefs, now);
  await write(key, {
    inside: true,
    exitedAt: previous?.exitedAt || 0,
    lastAction: previous?.lastAction || 0,
    visitId: Crypto.randomUUID(),
  } satisfies Visit);
}
// ---- "Made it?" ------------------------------------------------------------------------------

const MADE_IT_KEY = 'made-it-watch';
const STILL_TASK = 'arrive-made-it-still-v1';
const STILL_NOTICE = 'made-it-still';
const readWatch = () => read<MadeItWatch | null>(MADE_IT_KEY, null);
const readPrefs = async () => ({
  ...initialPreferences,
  ...(await read('preferences', initialPreferences)),
});
/** Who to name, and which check-in a tap sends (a place's own, else Home, else the default). */
async function madeItFor(prefs: typeof initialPreferences, presetId?: string) {
  const [people, presets] = await Promise.all([
    read<Person[]>('people', []),
    read<Preset[]>('presets', initialPresets),
  ]);
  const person = people.find((p) => p.id === prefs.defaultRecipient) ?? people[0];
  const id =
    [presetId, 'home', prefs.defaultPreset].find((x) => x && presets.some((p) => p.id === x)) ||
    'elsewhere';
  return {
    person,
    presetId: id,
    ...madeItNotice(person?.name, presets.find((p) => p.id === id)?.name),
  };
}

/**
 * Sent "Coming": watch for the next arrival at a remembered place, and, if that option is on,
 * for staying in one spot anywhere.
 */
export async function watchForArrival() {
  const now = Date.now();
  const prefs = await readPrefs();
  const watch: MadeItWatch = { startedAt: now };
  await write(MADE_IT_KEY, watch);
  if (prefs.madeItWhenStill) await startStillWatch(watch, prefs, now).catch(() => {});
}
/** Another check-in went out (or the watch is over), so there's nothing left to ask. */
export async function stopWatchingForArrival() {
  await write<MadeItWatch | null>(MADE_IT_KEY, null);
  await stopStillWatch();
  await cancelArrivalNotice();
}

/**
 * Location updates come only while you move (every 100 m or so). Each one pushes the nudge
 * later, so it goes off once you've stayed put for the chosen minutes. Nothing leaves the phone.
 */
async function startStillWatch(watch: MadeItWatch, prefs: typeof initialPreferences, now: number) {
  if (Platform.OS === 'web') return;
  if (!(await Location.getBackgroundPermissionsAsync()).granted) return;
  await pushStillNudge(watch, prefs, now);
  if (await Location.hasStartedLocationUpdatesAsync(STILL_TASK)) return;
  await Location.startLocationUpdatesAsync(STILL_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 100,
    // Paused updates only resume when Arrive is opened, so a long red light would end the watch.
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,
    showsBackgroundLocationIndicator: false,
  });
}
export async function stopStillWatch() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(STILL_NOTICE).catch(() => {});
  if (await Location.hasStartedLocationUpdatesAsync(STILL_TASK).catch(() => false))
    await Location.stopLocationUpdatesAsync(STILL_TASK).catch(() => {});
}
/** (Re)sets the "stopped moving" nudge for minutes from now, or ends the watch if it's over. */
async function pushStillNudge(watch: MadeItWatch, prefs: typeof initialPreferences, now: number) {
  const at = nextStillNudge(watch, prefs.madeItStillMinutes, now);
  if (!at || !madeItDue(watch, prefs, now) || !prefs.madeItWhenStill) {
    await stopStillWatch();
    return;
  }
  const { person, presetId, title, body } = await madeItFor(prefs);
  if (!person) return stopWatchingForArrival();
  // The same identifier replaces the one already waiting.
  await localNotice(
    title,
    body,
    { kind: 'made-it', presetId },
    Math.round((at - now) / 1000),
    STILL_NOTICE,
  );
  await write(MADE_IT_KEY, { ...watch, stillDueAt: at } satisfies MadeItWatch);
}
async function handleStillMove() {
  const now = Date.now();
  const watch = await readWatch();
  // Already asked (the nudge went off), or the watch ended: stop watching location.
  if (!watch || madeItAsked(watch, now)) {
    if (watch) await write<MadeItWatch | null>(MADE_IT_KEY, null);
    return stopStillWatch();
  }
  await pushStillNudge(watch, await readPrefs(), now);
}
if (Platform.OS !== 'web')
  TaskManager.defineTask(STILL_TASK, ({ error }) =>
    error ? Promise.resolve() : handleStillMove().catch(() => {}),
  );

// ---- Arriving at a saved place ---------------------------------------------------------------

const ARRIVAL_KEY = 'arrival-notice';
const ARRIVAL_ID = 'arrival';
const STARTED_KEY = 'geofences-started-at';
/** Developer tests: a short stay instead of the real one, so an arrival shows in seconds. */
let simulatedDwellMs: number | null = null;
/**
 * Developer tests: arrive at or leave your first saved place, as if iOS had reported it. The
 * real handling runs (Arrive Plus, days, notifications), minus the wait for monitoring to
 * settle; an arrival's stay is 10 seconds. Returns the place's name.
 */
export async function simulatePlaceEvent(kind: 'enter' | 'exit') {
  const place = (await read<Place[]>('places', [])).find((p) => p.enabled);
  if (!place) throw new Error('Save a place with “Remember this place” on first.');
  const key = `visit:${place.id}`;
  const visit = await read<Visit | null>(key, null);
  // Start from the opposite side, so the event is a real crossing.
  await write<Visit>(key, {
    inside: kind === 'exit',
    exitedAt: visit?.exitedAt || 0,
    lastAction: visit?.lastAction || 0,
    visitId: visit?.visitId || Crypto.randomUUID(),
  });
  if (kind === 'enter') {
    await write(STARTED_KEY, 0);
    await write<ArrivalNotice | null>(ARRIVAL_KEY, null);
  }
  simulatedDwellMs = 10_000;
  try {
    await handleEvent(
      kind === 'enter' ? Location.GeofencingEventType.Enter : Location.GeofencingEventType.Exit,
      {
        identifier: place.id,
        latitude: place.latitude,
        longitude: place.longitude,
        radius: place.radius,
        state:
          kind === 'enter'
            ? Location.GeofencingRegionState.Inside
            : Location.GeofencingRegionState.Outside,
      },
    );
  } finally {
    simulatedDwellMs = null;
  }
  return place.name;
}
/** A check-in went out, or you left before the dwell: the waiting arrival notification goes. */
export async function cancelArrivalNotice(placeId?: string) {
  const current = await read<ArrivalNotice | null>(ARRIVAL_KEY, null);
  if (!current || current.dueAt <= Date.now()) return;
  if (placeId && current.placeId !== placeId) return;
  await Notifications.cancelScheduledNotificationAsync(ARRIVAL_ID).catch(() => {});
  await write<ArrivalNotice | null>(ARRIVAL_KEY, null);
}
/**
 * Entered a saved place. If a traveling banner is up, its check-in moves first and lights up
 * now. After a short stay (so driving past doesn't count), a notification asks you to let your
 * person know. It never assumes you checked in: tapping it opens Messages with that place's
 * check-in, ready to send.
 */
async function arrivedAt(place: Place, prefs: typeof initialPreferences, now: number) {
  const startedAt = await read<number>(STARTED_KEY, 0);
  if (now - startedAt < MONITORING_SETTLE_MS) return;
  if (place.presetId) await highlightArrival(place.presetId).catch(() => {});
  if (!activeOn(prefs, now)) return;
  // Already told them from here (checked in just before iOS noticed the arrival).
  const r = await readReminder();
  if (r?.source === 'checkedIn' && r.atPresetId === place.presetId && now - r.createdAt < 3600_000)
    return;
  const current = await read<ArrivalNotice | null>(ARRIVAL_KEY, null);
  if (arrivalDecision({ place, current, monitoringStartedAt: startedAt, now }) === 'skip') return;
  const [people, presets] = await Promise.all([
    read<Person[]>('people', []),
    read<Preset[]>('presets', initialPresets),
  ]);
  const person = people.find((p) => p.id === prefs.defaultRecipient) ?? people[0];
  if (!person) return;
  const preset = presets.find((p) => p.id === place.presetId);
  const { title } = arrivalNotice(person.name, place.name, place.presetId === 'home');
  const body = preset ? `Tap to send your ${preset.name} check-in.` : 'Tap to send a check-in.';
  const dwell = simulatedDwellMs ?? ARRIVAL_DWELL_MS;
  // The same identifier replaces any arrival notification still waiting (overlapping places).
  const id = await localNotice(
    title,
    body,
    { kind: 'arrival', presetId: preset?.id ?? '' },
    Math.round(dwell / 1000),
    ARRIVAL_ID,
  );
  if (!id) return;
  await write<ArrivalNotice>(ARRIVAL_KEY, {
    placeId: place.id,
    radius: place.radius,
    dueAt: now + dwell,
  });
  // Arriving somewhere saved answers "Made it?", so "stopped moving" stops watching.
  await write<MadeItWatch | null>(MADE_IT_KEY, null);
  await stopStillWatch();
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
  // iOS now reports places you're already in as entries; arrivedAt ignores those.
  await write(STARTED_KEY, Date.now());
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
