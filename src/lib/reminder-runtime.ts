import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { read, write } from './storage';
import { localNotice } from './notifications';
import {
  createReminder,
  isOpen,
  isShowing,
  reconcile,
  transition,
  type Reminder,
  type ReminderEvent,
  type ReminderSource,
} from './reminder';
import { activityShortcuts } from './domain';
import { hasAccessCached } from './access';
import { cancelDepartureCheckIn, requestDepartureCheckIn } from './smart-reminders';
import { widgetIconAsset } from './widget-icons';
import { sfSymbols } from './sf-symbols';
import {
  initialPreferences,
  initialPresets,
  type Person,
  type Preferences,
  type Preset,
} from './types';
import { accents } from '@/design/theme';
import type { ReminderActivityProps } from '@/widgets/ReminderActivity';

// Connects the reminder state machine to local storage, the Lock Screen Live Activity,
// and local notifications. Everything here stays on the device.

const KEY = 'reminder';
const DISMISSED_KEY = 'reminder-dismissed';
export const DEPARTURE_TITLE = 'Heading somewhere? ❤️';
export const DEPARTURE_BODY = 'Remember to let your person know when you arrive.';
// Tapping anywhere on the Live Activity opens Home. This URL is fixed for the
// activity's lifetime, so it names no reminder; the current one is read from storage.
const CHECK_IN_URL = 'arrive://check-in?from=reminder';
// The Check In button skips the chooser and opens Messages with the default check-in.
const QUICK_CHECK_IN_URL = 'arrive://check-in?from=reminder&quick=1';
const DISMISS_URL = 'arrive://reminder?action=dismiss';

// ---- Live Activity bridge ---------------------------------------------------------------

type Factory = typeof import('@/widgets/ReminderActivity').default;
type Instance = ReturnType<Factory['start']>;
let factory: Promise<Factory | null> | null = null;

/** Live Activities need iOS 16.2+ and a build that includes Arrive's widget extension. */
export const liveActivitiesAvailable =
  Platform.OS === 'ios' &&
  Number.parseFloat(String(Platform.Version)) >= 16.2 &&
  !!requireOptionalNativeModule('ExpoWidgets');

function loadFactory() {
  if (!liveActivitiesAvailable) return Promise.resolve(null);
  // Imported lazily: expo-widgets fails at import time in builds without its native module.
  factory ??= import('@/widgets/ReminderActivity').then((m) => m.default).catch(() => null);
  return factory;
}
async function instances(): Promise<Instance[]> {
  const f = await loadFactory();
  if (!f) return [];
  try {
    return f.getInstances();
  } catch {
    return [];
  }
}
/** iOS 17 added buttons that run in the background, so a tap needn't open Arrive. */
const interactiveActivities =
  Platform.OS === 'ios' && Number.parseFloat(String(Platform.Version)) >= 17;
// The local module and exact widget icon catalog arrive in the same native build. Older binaries
// keep using visible SF Symbols until that build is installed.
const exactWidgetIconsAvailable = !!requireOptionalNativeModule('ArriveWidgetStatus');
async function props(r: Reminder): Promise<ReminderActivityProps> {
  const [p, presets] = await Promise.all([prefs(), read<Preset[]>('presets', initialPresets)]);
  // Favorites choose the 2–4 shortcuts; the draggable Home preview controls their order.
  const coming = !!r.coming && r.phase !== 'completed';
  const shown = activityShortcuts(presets, p.activityPresetOrder);
  return {
    phase:
      r.phase === 'checkingIn' ? 'checkingIn' : r.phase === 'completed' ? 'completed' : 'active',
    design: p.lockScreenStyle === 'glass' ? 'glass' : 'soft',
    showButtonLabels: p.activityButtonLabels !== false,
    title:
      r.phase === 'completed'
        ? 'Check-in sent ✓'
        : r.phase === 'checkingIn'
          ? 'Opening Messages…'
          : r.source === 'smart'
            ? 'Went separate ways? Check in.'
            : r.placeName && r.source !== 'manual'
              ? `Left ${r.placeName}. Where to?`
              : 'Where did you make it to?',
    checkInUrl: QUICK_CHECK_IN_URL,
    dismissUrl: DISMISS_URL,
    interactive: interactiveActivities,
    exactIcons: exactWidgetIconsAvailable,
    ...(coming ? { coming: { url: `${QUICK_CHECK_IN_URL}&coming=1` } } : {}),
    places: shown.map((preset) => ({
      id: preset.id,
      label: preset.name,
      iconAsset: widgetIconAsset(preset.icon),
      symbol: sfSymbols[preset.icon] ?? 'mappin',
      // Each one opens Messages with that check-in's words and person.
      url: `${QUICK_CHECK_IN_URL}&preset=${encodeURIComponent(preset.id)}`,
      ...(accents[preset.color] ?? accents.mint),
    })),
  };
}
// What Arrive last sent to the Live Activity, so an unchanged redraw can be skipped.
// Stored, because a Lock Screen tap can launch Arrive fresh in the background.
const PUSHED_KEY = 'reminder-activity-pushed';
/** Starts the Live Activity, or reuses the one already showing. Returns its id, or null. */
async function showActivity(r: Reminder): Promise<string | null> {
  const f = await loadFactory();
  if (!f) return null;
  const running = await instances();
  const [first, ...extra] = running;
  // One Arrive reminder at a time: reuse the first, end any others.
  await Promise.all(extra.map((i) => i.end('immediate').catch(() => {})));
  try {
    const stale = new Date(r.expiresAt);
    const next = await props(r);
    const json = JSON.stringify(next);
    if (first) {
      // Only redraw when something changed. The Lock Screen buttons edit the activity
      // natively, and tapping one launches Arrive in the background, which reconciles.
      // Pushing the same props again would undo the tap straight away.
      const pushed = `${first.getId()}:${json}`;
      if ((await read<string>(PUSHED_KEY, '')) !== pushed) {
        await first.update(next, stale);
        await write(PUSHED_KEY, pushed);
      }
      return first.getId();
    }
    const id = f.start(next, CHECK_IN_URL, stale).getId();
    await write(PUSHED_KEY, `${id}:${json}`);
    return id;
  } catch {
    // Live Activities are turned off for Arrive in Settings, or iOS refused the request.
    return null;
  }
}
async function endActivities(final?: Reminder) {
  const running = await instances();
  const finalProps = final?.phase === 'completed' ? await props(final) : null;
  await Promise.all(
    running.map((i) =>
      finalProps
        ? // Show "Check-in sent" briefly, then leave the Lock Screen.
          i.end({ after: new Date(Date.now() + 4000) }, finalProps).catch(() => {})
        : i.end('immediate').catch(() => {}),
    ),
  );
}

// ---- Local state ----------------------------------------------------------------------

const listeners = new Set<(r: Reminder | null) => void>();
export function subscribeReminder(fn: (r: Reminder | null) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const readReminder = () => read<Reminder | null>(KEY, null);
async function save(r: Reminder | null) {
  await write(KEY, r);
  if (r?.phase === 'dismissed') {
    const ids = await read<string[]>(DISMISSED_KEY, []);
    await write(DISMISSED_KEY, [r.id, ...ids.filter((id) => id !== r.id)].slice(0, 30));
  }
  listeners.forEach((fn) => fn(r));
  return r;
}
async function prefs(): Promise<Preferences> {
  return { ...initialPreferences, ...(await read<Partial<Preferences>>('preferences', {})) };
}
async function apply(event: ReminderEvent) {
  const current = await readReminder();
  if (!isOpen(current)) return current;
  return save(transition(current, event, Date.now()));
}

// ---- Public actions -----------------------------------------------------------------------

// Every change runs one at a time. On a cold launch from the Live Activity, the startup
// reconcile and the forwarded send both touch the reminder, and must not overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function serial<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  return (...args: A): Promise<R> => {
    const run = queue.then(() => fn(...args));
    queue = run.catch(() => {});
    return run;
  };
}

/**
 * Called from the background geofence task when someone leaves a place with departure
 * reminders on. iOS won't start a Live Activity from the background, so this schedules the
 * one-time notification and records a pending reminder. The Live Activity starts the next
 * time Arrive is in the foreground (for example, when that notification is tapped).
 */
async function scheduleDepartureReminderNow(input: {
  visitId: string;
  placeId: string;
  placeName: string;
  recipientId: string;
  delayMinutes: number;
  /** Left the spot of the last check-in, so the Live Activity offers "Coming". */
  coming?: boolean;
}) {
  const now = Date.now();
  const dismissed = await read<string[]>(DISMISSED_KEY, []);
  if (dismissed.includes(input.visitId)) return undefined;
  const current = await readReminder();
  // One reminder at a time. A new departure replaces a pending one, but not one already showing.
  if (isShowing(current)) return undefined;
  // The Live Activity is the reminder. iOS won't let Arrive start one from the background, so
  // the Smart Check-In service starts it by push after the delay. Only if that's impossible
  // (no service, no network, Live Activities off) does one notification stand in for it.
  const delay = input.delayMinutes === 1 || input.delayMinutes === 10 ? input.delayMinutes : 5;
  const viaLiveActivity = await requestDepartureCheckIn(input.visitId, delay, input.coming)
    .then(() => true)
    .catch(() => false);
  const notificationId = viaLiveActivity
    ? undefined
    : await localNotice(
        DEPARTURE_TITLE,
        DEPARTURE_BODY,
        {
          kind: 'departure',
          placeId: input.placeId,
          recipientId: input.recipientId,
          reminder: '1',
        },
        input.delayMinutes * 60,
        `departure-${input.placeId}`,
      );
  await save(
    createReminder(
      {
        id: input.visitId,
        source: 'departure',
        placeId: input.placeId,
        placeName: input.placeName,
        recipientId: input.recipientId,
        ...(input.coming ? { coming: true } : {}),
      },
      now,
      input.delayMinutes * 60000,
    ),
  );
  return notificationId;
}

/** The person came back before the delay passed, so the pending reminder is withdrawn. */
async function cancelScheduledReminderNow(placeId: string) {
  const current = await readReminder();
  if (current?.phase === 'scheduled' && current.placeId === placeId) {
    await apply({ type: 'cancel' });
    await cancelDepartureCheckIn().catch(() => {});
  }
}

/**
 * Starts a reminder right now, from the foreground (developer tests).
 * Shows it on the Lock Screen when possible; otherwise falls back to a notification later.
 */
async function startReminderNow(source: ReminderSource = 'manual', coming = false) {
  const p = await prefs();
  const now = Date.now();
  const reminder = createReminder(
    {
      id: `${source}-${now}`,
      source,
      recipientId: p.defaultRecipient,
      ...(coming ? { coming: true } : {}),
    },
    now,
  );
  const activityId = await showActivity(reminder);
  if (activityId) {
    await save(transition(reminder, { type: 'activate', activityId }, now));
    return 'lockScreen' as const;
  }
  // No Live Activity: a single notification after the usual delay stands in for it.
  await localNotice(
    DEPARTURE_TITLE,
    DEPARTURE_BODY,
    { kind: 'departure', placeId: '', recipientId: p.defaultRecipient, reminder: '1' },
    Math.max(60, p.reminderMinutes * 60),
    'departure-manual',
  );
  await save(reminder);
  return 'notification' as const;
}

/**
 * Brings the Live Activity in line with the stored reminder. Runs at launch and whenever
 * Arrive returns to the foreground, so relaunches and restarts never create duplicates.
 */
async function reconcileReminderNow() {
  // Without Arrive Plus there's no Lock Screen reminder; end any that's still showing.
  if (!(await hasAccessCached())) {
    await endActivities();
    const r = await readReminder();
    if (isOpen(r)) await save(transition(r, { type: 'dismiss' }, Date.now()));
    return r;
  }
  const p = await prefs();
  const running = await instances();
  let current = await readReminder();
  // A Smart Check-In the service started by push isn't in local state yet. Adopt it as this
  // phone's reminder, so it gets the usual check-ins, design and endings, instead of being
  // tidied away as a stray. (An activity Arrive itself just ended is still listed for a few
  // seconds, so only one it hasn't seen counts.)
  if (p.smartCheckIn && !isOpen(current)) {
    const pushed = running.find((i) => i.getId() !== current?.activityId);
    const id = pushed && `smart-${pushed.getId()}`;
    if (pushed && id && !(await read<string[]>(DISMISSED_KEY, [])).includes(id)) {
      const partner = (await read<Person[]>('people', [])).find((x) => x.smartPaired);
      const now = Date.now();
      current = await save(
        transition(
          createReminder(
            { id, source: 'smart', recipientId: partner?.id || p.defaultRecipient },
            now,
          ),
          { type: 'activate', activityId: pushed.getId() },
          now,
        ),
      );
    }
  }
  const { reminder, action } = reconcile(current, Date.now(), {
    running: running.length,
    supported: liveActivitiesAvailable,
    // The Live Activity is the reminder; a notification stands in only where it can't run.
    enabled: true,
  });
  if (action === 'endAll') await endActivities();
  let next = reminder;
  if ((action === 'start' || action === 'update') && reminder) {
    const activityId = await showActivity(reminder);
    if (activityId) next = transition(reminder, { type: 'activate', activityId }, Date.now());
  }
  if (next !== current) await save(next);
  return next;
}

/** Withdraws a reminder that hasn't shown yet (departure reminders were turned off). */
async function cancelPendingReminderNow() {
  const current = await readReminder();
  if (current?.phase === 'scheduled') await apply({ type: 'cancel' });
  // A departure waiting on the service is withdrawn too.
  await cancelDepartureCheckIn().catch(() => {});
}
/** Messages is opening for a check-in from the reminder. */
async function markCheckingInNow() {
  const r = await apply({ type: 'checkIn' });
  if (isShowing(r)) await showActivity(r);
  return r;
}
/** Messages closed without a confirmed send. The reminder stays on the Lock Screen. */
async function cancelCheckingInNow() {
  const r = await apply({ type: 'cancelCheckIn' });
  if (isShowing(r) && r.activityId) await showActivity(r);
}
/** Messages reported a send. Ends the reminder and its Live Activity. */
async function completeReminderNow() {
  // Checked in before a departure's Smart Check-In showed: it has nothing left to remind about.
  const pending = await readReminder();
  if (pending?.phase === 'scheduled') {
    await apply({ type: 'cancel' });
    if (pending.placeId)
      await Notifications.cancelScheduledNotificationAsync(`departure-${pending.placeId}`).catch(
        () => {},
      );
    await cancelDepartureCheckIn().catch(() => {});
  }
  const r = await apply({ type: 'complete' });
  await endActivities(r?.phase === 'completed' ? r : undefined);
  await Notifications.cancelScheduledNotificationAsync('departure-manual').catch(() => {});
}
/** The person said "not now". This event won't remind them again. */
async function dismissReminderNow() {
  const r = await readReminder();
  await apply({ type: 'dismiss' });
  await endActivities();
  if (r?.placeId)
    await Notifications.cancelScheduledNotificationAsync(`departure-${r.placeId}`).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('departure-manual').catch(() => {});
}

// ---- Development only ---------------------------------------------------------------------

/** Simulates leaving a place: a reminder becomes due after a few seconds. */
async function simulateDepartureNow(seconds = 10) {
  const p = await prefs();
  const now = Date.now();
  await localNotice(
    DEPARTURE_TITLE,
    DEPARTURE_BODY,
    { kind: 'departure', placeId: '', recipientId: p.defaultRecipient, reminder: '1' },
    seconds,
    'departure-test',
  );
  await save(
    createReminder(
      {
        id: `test-${now}`,
        source: 'test',
        placeName: 'Test place',
        recipientId: p.defaultRecipient,
      },
      now,
      seconds * 1000,
    ),
  );
}
/** Pushes a visible change to the running Live Activity. */
async function updateTestActivityNow() {
  const [first] = await instances();
  if (!first) throw new Error('No Arrive Live Activity is running. Start one first.');
  await first.update({
    ...(await props(
      (await readReminder()) || createReminder({ id: 'x', source: 'test' }, Date.now()),
    )),
    title: `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`,
  });
}

/**
 * ✕ on the Lock Screen while Arrive is running. The patched expo-widgets intent already
 * ended the activity natively; this records the dismissal right away (and ends it here too,
 * in case the native step didn't run).
 */
async function handleActivityButtonNow(target: string) {
  if (target === 'end') await dismissReminderNow();
}
/** Starts listening for Lock Screen button taps. Returns a function that stops. */
export function watchActivityButtons() {
  if (!liveActivitiesAvailable) return () => {};
  let stop: (() => void) | undefined;
  let stopped = false;
  // Imported lazily for the same reason as the factory.
  void import('expo-widgets')
    .then(({ addUserInteractionListener }) => {
      if (stopped) return;
      const sub = addUserInteractionListener((e) => {
        // A Live Activity button reports the activity's id as its source, not its name.
        // Arrive has one Live Activity and the Lock Screen widget has no buttons, so any
        // of these targets is the reminder's.
        if (e.target === 'end') void handleActivityButton(e.target).catch(() => {});
      });
      stop = () => sub.remove();
    })
    .catch(() => {});
  return () => {
    stopped = true;
    stop?.();
  };
}
const handleActivityButton = serial(handleActivityButtonNow);

export const scheduleDepartureReminder = serial(scheduleDepartureReminderNow);
export const cancelPendingReminder = serial(cancelPendingReminderNow);
export const cancelScheduledReminder = serial(cancelScheduledReminderNow);
export const startReminder = serial(startReminderNow);
export const reconcileReminder = serial(reconcileReminderNow);
export const markCheckingIn = serial(markCheckingInNow);
export const cancelCheckingIn = serial(cancelCheckingInNow);
export const completeReminder = serial(completeReminderNow);
export const dismissReminder = serial(dismissReminderNow);
export const simulateDeparture = serial(simulateDepartureNow);
export const updateTestActivity = serial(updateTestActivityNow);
