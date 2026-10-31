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
