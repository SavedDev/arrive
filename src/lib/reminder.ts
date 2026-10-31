// The "remember to check in" reminder, as one explicit state machine.
// Pure: no storage or native calls, so it can be unit tested in Node.

export type ReminderPhase =
  | 'inactive' // nothing pending
  | 'scheduled' // a departure was seen; waiting out the configured delay
  | 'active' // shown on the Lock Screen (or notified, when Live Activities are unavailable)
  | 'checkingIn' // the person opened Arrive from the reminder and is choosing a check-in
  | 'completed' // a send was confirmed by Messages
  | 'dismissed' // the person chose not to be reminded about this event
  | 'expired'; // nobody acted before the timeout

/** "smart": a Smart Reminder the server started on the Lock Screen after a separation. */
export type ReminderSource = 'departure' | 'manual' | 'test' | 'smart';

export type Reminder = {
  /** One id per reminder event. A departure uses the geofence visit id, so repeats are detectable. */
  id: string;
  phase: ReminderPhase;
  source: ReminderSource;
  placeId?: string;
  placeName?: string;
  recipientId?: string;
  /** Started by leaving the spot of the last check-in: its Live Activity offers "Coming". */
  coming?: boolean;
  createdAt: number;
  /** When the reminder should become active. */
  dueAt: number;
  /** After this, the reminder ends on its own. */
  expiresAt: number;
  /** The Live Activity showing this reminder, once one was started. */
  activityId?: string;
  updatedAt: number;
};

/** Abandoned reminders end after this long, well inside iOS's own 8-hour Live Activity limit. */
export const REMINDER_LIFETIME = 3 * 60 * 60 * 1000;
/** A check-in that was opened but never finished goes back to active after this long. */
export const CHECKING_IN_TIMEOUT = 15 * 60 * 1000;

export type ReminderEvent =
  | { type: 'activate'; activityId?: string }
  | { type: 'checkIn' }
  | { type: 'cancelCheckIn' }
  | { type: 'complete' }
  | { type: 'dismiss' }
  | { type: 'expire' }
  | { type: 'cancel' };

const terminal: ReminderPhase[] = ['inactive', 'completed', 'dismissed', 'expired'];
export const isOpen = (r: Reminder | null): r is Reminder => !!r && !terminal.includes(r.phase);
/** Showing on the Lock Screen or being acted on right now. */
export const isShowing = (r: Reminder | null): r is Reminder =>
  !!r && (r.phase === 'active' || r.phase === 'checkingIn');

export function createReminder(
  input: Pick<Reminder, 'id' | 'source' | 'placeId' | 'placeName' | 'recipientId' | 'coming'>,
  now: number,
  delayMs = 0,
): Reminder {
  const dueAt = now + delayMs;
  return {
    ...input,
    phase: delayMs > 0 ? 'scheduled' : 'active',
    createdAt: now,
    dueAt,
    expiresAt: dueAt + REMINDER_LIFETIME,
    updatedAt: now,
  };
}

/** Applies one event. Events that don't make sense in the current phase leave it unchanged. */
export function transition(r: Reminder, event: ReminderEvent, now: number): Reminder {
  const to = (phase: ReminderPhase, extra: Partial<Reminder> = {}) => ({
    ...r,
    ...extra,
    phase,
    updatedAt: now,
  });
  if (terminal.includes(r.phase)) return r;
  switch (event.type) {
    case 'activate':
      if (r.phase === 'scheduled' || r.phase === 'active')
        return to('active', event.activityId ? { activityId: event.activityId } : {});
      return r;
    case 'checkIn':
      return r.phase === 'active' || r.phase === 'scheduled' ? to('checkingIn') : r;
    case 'cancelCheckIn':
      return r.phase === 'checkingIn' ? to('active') : r;
    case 'complete':
      return to('completed');
    case 'dismiss':
      return to('dismissed');
    case 'expire':
      return to('expired');
    case 'cancel':
      // Only a reminder that never showed can be silently withdrawn (for example, the person came back).
      return r.phase === 'scheduled' ? to('inactive') : r;
  }
}

/** What should happen to a reminder when Arrive comes to the foreground. */
export function reconcile(
  r: Reminder | null,
  now: number,
  activity: { running: number; supported: boolean; enabled: boolean },
): { reminder: Reminder | null; action: 'none' | 'start' | 'update' | 'endAll' } {
  if (!isOpen(r)) return { reminder: r, action: activity.running ? 'endAll' : 'none' };
  if (now >= r.expiresAt)
    return { reminder: transition(r, { type: 'expire' }, now), action: 'endAll' };
  let next = r;
  if (next.phase === 'checkingIn' && now - next.updatedAt > CHECKING_IN_TIMEOUT)
    next = transition(next, { type: 'cancelCheckIn' }, now);
  if (next.phase === 'scheduled') {
    if (now < next.dueAt) return { reminder: next, action: activity.running ? 'endAll' : 'none' };
    next = transition(next, { type: 'activate' }, now);
  }
  const useActivity = activity.supported && activity.enabled;
  if (!useActivity) return { reminder: next, action: activity.running ? 'endAll' : 'none' };
  if (activity.running) return { reminder: next, action: 'update' };
  // It was on the Lock Screen and is gone now, so the person removed it.
  if (next.activityId)
    return { reminder: transition(next, { type: 'dismiss' }, now), action: 'none' };
  return { reminder: next, action: 'start' };
}
