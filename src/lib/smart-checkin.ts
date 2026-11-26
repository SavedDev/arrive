import type { Place, Preferences } from './types';

// Smart Check-In: one reminder, the Live Activity, started by either trigger (going separate
// ways from a paired person, or leaving a remembered place) on the chosen days, after the
// chosen delay. Manual check-ins ignore all of this and always work.

/** Days as the phone numbers them: 0 = Sunday … 6 = Saturday. */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** The same days as a bitmask, bit 0 = Sunday, as the Smart Check-In service stores them. */
export const daysMask = (days: number[]) =>
  days.reduce((mask, day) => (day >= 0 && day <= 6 ? mask | (1 << day) : mask), 0);

type Schedule = Pick<Preferences, 'smartCheckIn' | 'activeDays'>;
/** Whether Smart Check-In may start at `at`, by the phone's own calendar. */
export const activeOn = (prefs: Schedule, at: number | Date) =>
  prefs.smartCheckIn && prefs.activeDays.includes(new Date(at).getDay());

type Triggers = Pick<Preferences, 'smartCheckIn' | 'departureReminders' | 'smartReminders'>;
/** Leaving a remembered place is a trigger, and there's a place to leave. */
export const departureTriggerOn = (prefs: Triggers, places: Pick<Place, 'enabled'>[]) =>
  prefs.smartCheckIn && prefs.departureReminders && places.some((p) => p.enabled);
/** Going separate ways is a trigger. Pairing itself is checked with the service. */
export const separationTriggerOn = (prefs: Triggers) => prefs.smartCheckIn && prefs.smartReminders;
/** Either trigger needs this phone registered for Live Activity pushes. */
export const needsSmartService = (prefs: Triggers, places: Pick<Place, 'enabled'>[]) =>
  departureTriggerOn(prefs, places) || separationTriggerOn(prefs);

// ---- "Made it?" -----------------------------------------------------------------------------

/**
 * After a "Coming" check-in, Arrive watches this long for you to reach one of your remembered
 * places, then asks whether you made it. Coming implies a second check-in; others don't.
 */
export const MADE_IT_WINDOW_MS = 3 * 60 * 60 * 1000;
export type MadeItWatch = {
  startedAt: number;
  /** When the "stopped moving" nudge is set to go off; each move pushes it later. */
  stillDueAt?: number;
};
/** Whether arriving at a remembered place at `now` should ask "Made it?". */
export const madeItDue = (
  watch: MadeItWatch | null,
  prefs: Pick<Preferences, 'smartCheckIn'>,
  now: number,
) =>
  !!watch &&
  prefs.smartCheckIn &&
  now >= watch.startedAt &&
  now - watch.startedAt <= MADE_IT_WINDOW_MS;
/** The "stopped moving" nudge already went off, so arriving somewhere shouldn't ask again. */
export const madeItAsked = (watch: MadeItWatch | null, now: number) =>
  !!watch?.stillDueAt && watch.stillDueAt <= now;
/**
 * You moved: when the "stopped moving" nudge should now go off, or null when that would fall
 * outside the window (so it's dropped and location watching stops).
 */
export const nextStillNudge = (watch: MadeItWatch, minutes: number, now: number) => {
  const at = now + minutes * 60_000;
  return at - watch.startedAt <= MADE_IT_WINDOW_MS ? at : null;
};
/** The nudge, naming your person and the check-in a tap sends. */
export const madeItNotice = (personName?: string, checkInName?: string) => ({
  title: `Made it? Let ${personName?.trim() || 'your person'} know.`,
  body: checkInName?.trim()
    ? `Tap to send your ${checkInName.trim()} check-in.`
    : 'Tap to send a check-in.',
});

// ---- Arriving at a saved place ---------------------------------------------------------------

/** Stay this long inside a saved place before "Let Sarah know you made it": not just passing. */
export const ARRIVAL_DWELL_MS = 2 * 60_000;
/** After one arrival notification, none for this long, wherever you are. */
export const ARRIVAL_COOLDOWN_MS = 30 * 60_000;
/**
 * When monitoring (re)starts, iOS reports every place you're already inside as an entry. Those
 * aren't arrivals, so entries this soon after a (re)start don't notify.
 */
export const MONITORING_SETTLE_MS = 60_000;
/** The arrival notification set (or recently shown) for a saved place. */
export type ArrivalNotice = { placeId: string; radius: number; dueAt: number };
/**
 * Entered a saved place: notify (after the dwell), or not. Overlapping places keep one
 * notification, for the smaller (more specific) place.
 */
export function arrivalDecision(input: {
  place: { id: string; radius: number };
  current: ArrivalNotice | null;
  monitoringStartedAt: number;
  now: number;
}): 'notify' | 'skip' {
  const { place, current, now } = input;
  if (now - input.monitoringStartedAt < MONITORING_SETTLE_MS) return 'skip';
  if (!current) return 'notify';
  // Already shown: wait out the cooldown.
  if (current.dueAt <= now) return now - current.dueAt < ARRIVAL_COOLDOWN_MS ? 'skip' : 'notify';
  // One is waiting for its dwell: a different, smaller place replaces it.
  return current.placeId !== place.id && place.radius < current.radius ? 'notify' : 'skip';
}
/** "Let Sarah know you made it to Work", or "…made it Home". */
export const arrivalNotice = (personName: string, placeName: string, home: boolean) => ({
  title: `Let ${personName.trim() || 'your person'} know you made it ${home ? 'Home' : `to ${placeName.trim()}`}`,
});
