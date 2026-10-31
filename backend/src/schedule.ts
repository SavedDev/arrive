// Smart Check-In's schedule rules, shared by both triggers. Pure, so they're unit tested.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ALL_DAYS = 0b1111111;
/** Two triggers for the same event (say, leaving home together, then splitting up) land
 * within this window; only the first starts a Live Activity. */
export const DUPLICATE_WINDOW_MS = 15 * 60_000;

/** The weekday (0 = Sunday) at `at` in `timeZone`, falling back to UTC for an unknown zone. */
export function weekdayIn(timeZone: string | null, at: number) {
  try {
    const name = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: timeZone || 'UTC',
    }).format(new Date(at));
    return WEEKDAYS.indexOf(name);
  } catch {
    return new Date(at).getUTCDay();
  }
}
/** Whether Smart Check-In may start on the day `at` falls on for this device. */
export function activeOn(days: number, timeZone: string | null, at: number) {
  return (days & (1 << weekdayIn(timeZone, at))) !== 0;
}
export const recentlyReminded = (lastReminderAt: number | null, now: number) =>
  lastReminderAt != null && now - lastReminderAt < DUPLICATE_WINDOW_MS;
export const validDays = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= ALL_DAYS;
export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
