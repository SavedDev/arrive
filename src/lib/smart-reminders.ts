import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { read, remove, write } from './storage';
import { errorMessage } from './domain';
import { daysMask } from './smart-checkin';

const TASK = 'arrive-smart-location-v1';
const CREDENTIALS = 'arrive.smart-reminders.credentials';
const BUILD_REQUIRED =
  'Smart Reminders require a newer Arrive build. Install the latest development build, then try again.';
const URL = (process.env.EXPO_PUBLIC_SMART_REMINDERS_URL || '').replace(/\/$/, '');
type Credentials = { deviceId: string; secret: string };
type LastUpload = { latitude: number; longitude: number; accuracy: number; capturedAt: number };
export type SmartStatus = {
  enabled: boolean;
  pair: null | {
    pairId: string;
    reminderDelayMinutes: 1 | 5 | 10;
    status: string;
    proximityState: 'unknown' | 'together' | 'possiblySeparated' | 'separated' | null;
  };
};

function configuredUrl() {
  if (!URL) throw new Error('Smart Reminders are not configured in this build.');
  if (!/^https:\/\//.test(URL) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(URL))
    throw new Error('Smart Reminders require a secure HTTPS service.');
  return URL;
}
const hex = (bytes: Uint8Array) =>
  [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
async function secureStore() {
  // Importing expo-secure-store when its native module is absent produces a React Native redbox
  // before the rejected import can be handled. Check the binary first so older builds get a
  // normal, actionable message instead.
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSecureStore'))
    throw new Error(BUILD_REQUIRED);
  try {
    const store = await import('expo-secure-store');
    if (!store?.getItemAsync || !store.setItemAsync || !store.deleteItemAsync)
      throw new Error(BUILD_REQUIRED);
    return store;
  } catch {
    throw new Error(BUILD_REQUIRED);
  }
}
async function credentials() {
  if (Platform.OS === 'web') throw new Error('Smart Reminders require the iOS or Android app.');
  const store = await secureStore();
  const saved = await store.getItemAsync(CREDENTIALS);
  if (saved) return JSON.parse(saved) as Credentials;
  const secret = hex(Crypto.getRandomBytes(32));
  const response = await fetch(`${configuredUrl()}/v1/devices/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, platform: Platform.OS }),
  });
  const result = (await response.json()) as { deviceId?: string; error?: string };
  if (!response.ok || !result.deviceId)
    throw new Error(result.error || 'Could not register this device.');
  const value = { deviceId: result.deviceId, secret };
  await store.setItemAsync(CREDENTIALS, JSON.stringify(value));
  return value;
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await credentials();
  const response = await fetch(`${configuredUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      authorization: `Bearer ${auth.deviceId}.${auth.secret}`,
      ...init?.headers,
    },
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Smart Reminders are unavailable.');
  return result;
}
export const getSmartStatus = () => api<SmartStatus>('/v1/pair');
/** Tells the service which days Smart Check-In may start, in this phone's time zone. */
export const syncCheckInSchedule = (activeDays: number[]) =>
  api<{ ok: boolean }>('/v1/checkin/settings', {
    method: 'PUT',
    body: JSON.stringify({
      activeDays: daysMask(activeDays),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }),
  });
/**
 * Left a remembered place: asks the service to start the Live Activity after the delay, since
 * iOS won't let Arrive start one from the background. Sends only an opaque event id and the
 * delay; no location, place name or contact. Throws if it can't, so the caller falls back.
 */
export const requestDepartureCheckIn = (
  eventId: string,
  delayMinutes: 1 | 5 | 10,
  coming = false,
) =>
  api<{ scheduled: boolean }>('/v1/checkin/departure', {
    method: 'POST',
    // "coming" only asks for the Coming shortcut; it says nothing about where.
    body: JSON.stringify({ eventId, delayMinutes, ...(coming ? { context: 'coming' } : {}) }),
  });
/** Came back, or already checked in: cancels any departure Smart Check-In still waiting. */
export const cancelDepartureCheckIn = () =>
  api<{ ok: boolean }>('/v1/checkin/departure', { method: 'DELETE' });
export const createSmartInvite = (reminderDelayMinutes: 1 | 5 | 10) =>
  api<{ token: string; expiresAt: number }>('/v1/pair/invites', {
    method: 'POST',
    body: JSON.stringify({ reminderDelayMinutes }),
  });
export const acceptSmartInvite = (token: string, reminderDelayMinutes: 1 | 5 | 10) =>
  api<{ pairId: string }>('/v1/pair/accept', {
    method: 'POST',
    body: JSON.stringify({ token, reminderDelayMinutes }),
  });
export const updateSmartSettings = (enabled: boolean, reminderDelayMinutes: 1 | 5 | 10) =>
  api<{ ok: boolean }>('/v1/pair/settings', {
    method: 'PUT',
    body: JSON.stringify({ enabled, reminderDelayMinutes }),
  });

function distance(a: LastUpload, b: LastUpload) {
  const rad = Math.PI / 180,
    dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(x));
}
async function upload(position: Location.LocationObject, signal = 'movement', force = false) {
  const next: LastUpload = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 10_000,
    capturedAt: position.timestamp,
  };
  if (next.accuracy > 100) return;
  const previous = await read<LastUpload | null>('smart-last-upload', null);
  if (
    !force &&
    previous &&
    distance(previous, next) < 100 &&
    next.capturedAt - previous.capturedAt < 15 * 60_000 &&
    previous.accuracy - next.accuracy < 25
  )
    return;
  await api('/v1/location', { method: 'PUT', body: JSON.stringify({ ...next, signal }) });
  await write('smart-last-upload', next);
  await write('smart-reminders-error', '');
}
export async function uploadUsefulLocation(signal = 'foreground', force = false) {
  if (Platform.OS === 'web') return;
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return;
  const position =
    (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000, requiredAccuracy: 100 })) ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  await upload(position, signal, force);
}
export async function requestSmartPermissions() {
  if (Platform.OS !== 'ios') throw new Error('Smart Reminders currently require an iPhone.');
  if (!(await Location.requestForegroundPermissionsAsync()).granted)
    throw new Error('Enable location access to use Smart Reminders.');
  if (!(await Location.requestBackgroundPermissionsAsync()).granted)
    throw new Error('Choose Always Allow location access for Smart Reminders.');
  if (!(await Notifications.requestPermissionsAsync()).granted)
    throw new Error('Enable notifications so Arrive can show a separation reminder.');
}
export async function startSmartMonitoring() {
  if (Platform.OS === 'web' || (await Location.hasStartedLocationUpdatesAsync(TASK))) return;
  if (!(await Location.getBackgroundPermissionsAsync()).granted) return;
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 100,
    deferredUpdatesDistance: 200,
    deferredUpdatesInterval: 5 * 60_000,
    pausesUpdatesAutomatically: true,
    activityType: Location.ActivityType.OtherNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Arrive Smart Reminders',
      notificationBody: 'Watching for separation with low-frequency location updates.',
    },
  });
}
export async function stopSmartMonitoring() {
  if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(TASK)))
    await Location.stopLocationUpdatesAsync(TASK);
}
export async function enableSmartReminders(delay: 1 | 5 | 10) {
  // Fail before asking for location or notification permissions when this is an older binary.
  await secureStore();
  await requestSmartPermissions();
  await updateSmartSettings(true, delay);
  await syncSmartRuntime(true);
}
export async function disableSmartReminders(delay: 1 | 5 | 10) {
  await updateSmartSettings(false, delay).catch(() => {});
  await stopSmartMonitoring();
  await remove('smart-last-upload');
}
export async function disconnectSmartReminders() {
  if (Platform.OS === 'web') {
    await remove('smart-last-upload');
    return;
  }
  const store = await secureStore();
  const saved = await store.getItemAsync(CREDENTIALS);
  if (saved) await api('/v1/pair/disconnect', { method: 'DELETE' }).catch(() => {});
  await stopSmartMonitoring();
  await Promise.all([
    store.deleteItemAsync(CREDENTIALS),
    remove('smart-last-upload'),
    remove(INVITE_KEY),
  ]);
}
export async function registerPushTokens(liveActivityToken?: string) {
  if (Platform.OS !== 'ios') return;
  // The Live Activity push-to-start token works without notification permission; the regular
  // device token is only needed for the one fallback notification.
  const permission = await Notifications.getPermissionsAsync();
  const deviceToken = permission.granted
    ? await Notifications.getDevicePushTokenAsync().catch(() => null)
    : null;
  const apnsToken = typeof deviceToken?.data === 'string' ? deviceToken.data : undefined;
  if (!apnsToken && !liveActivityToken) return;
  await api('/v1/push-tokens', {
    method: 'PUT',
    body: JSON.stringify({
      apnsToken,
      liveActivityToken,
      environment: __DEV__ ? 'sandbox' : 'production',
    }),
  });
}
/** When the latest unaccepted invitation stops being usable. */
const INVITE_KEY = 'smart-invite-expires';
export const rememberSmartInvite = (expiresAt: number) => write(INVITE_KEY, expiresAt);
export const smartInvitePending = async () => (await read<number>(INVITE_KEY, 0)) > Date.now();
/**
 * Background location runs only while the server confirms an active pair, so turning Smart
 * Reminders on, or waiting for someone to scan an invitation, never uploads anything.
 * Returns whether this phone is paired right now.
 */
export async function syncSmartRuntime(enabled: boolean): Promise<'off' | 'paired' | 'unpaired'> {
  if (!enabled) {
    await stopSmartMonitoring();
    return 'off';
  }
  const status = await getSmartStatus();
  if (status.pair?.status !== 'active') {
    await stopSmartMonitoring();
    return 'unpaired';
  }
  await remove(INVITE_KEY);
  await startSmartMonitoring();
  await Promise.allSettled([registerPushTokens(), uploadUsefulLocation('foreground')]);
  return 'paired';
}
export async function smartRuntimeError() {
  return read('smart-reminders-error', '');
}
export const simulateSmartScenario = (
  scenario:
    | 'together'
    | 'oneMovingAway'
    | 'bothLeavingTogether'
    | 'laterDiverging'
    | 'stale'
    | 'poorAccuracy'
    | 'reunion'
    | 'separationConfirmed'
    | 'reminderDue'
    | 'pushToStart',
) =>
  api<{ state: string; scheduled: boolean }>('/v1/dev/simulate', {
    method: 'POST',
    body: JSON.stringify({ scenario }),
  });

if (Platform.OS !== 'web')
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    TASK,
    async ({ data, error }) => {
      if (error) {
        await write('smart-reminders-error', error.message);
        return;
      }
      const latest = data?.locations.at(-1);
      if (!latest) return;
      await upload(latest).catch((reason) => write('smart-reminders-error', errorMessage(reason)));
    },
  );
