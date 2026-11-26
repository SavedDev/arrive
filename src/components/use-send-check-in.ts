import { useCallback, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { historyForResult } from '@/lib/composer';
import { errorMessage, leavingText } from '@/lib/domain';
import {
  anchorHere,
  clearAnchor,
  markManualArrival,
  stopWatchingForArrival,
  watchForArrival,
} from '@/lib/location';
import { openComposer } from '@/lib/messaging';
import { confirmSend } from '@/lib/notifications';
import {
  afterCheckIn,
  cancelCheckingIn,
  markCheckingIn,
  readReminder,
} from '@/lib/reminder-runtime';
import type { Preset } from '@/lib/types';
import { useApp } from '@/state/app';

/**
 * "Homebound": the heading-home message the Lock Screen offers after you check in somewhere, or
 * leave where you last did. Not one of the check-ins on Home, and not the same as Home (an
 * arrival).
 */
export const comingPreset = (message: string): Preset => ({
  id: 'coming',
  name: 'Homebound',
  icon: 'walk',
  color: 'mint',
  message,
  recipientId: '',
  favorite: false,
  order: -1,
});
/**
 * "Leaving": offered once you've checked in somewhere. Its words name that place, from the
 * "checked in" reminder on the Lock Screen.
 */
export async function leavingPreset(template: string): Promise<Preset> {
  const r = await readReminder().catch(() => null);
  return {
    ...comingPreset(leavingText(template, r?.source === 'checkedIn' ? r.atName : undefined)),
    id: 'leaving',
    name: 'Leaving',
    icon: 'walk',
  };
}

/**
 * Sends a check-in: opens Messages with the check-in's words and person, then records what
 * Messages reported. Arrive never sends on its own; the person taps Send in Messages.
 */
export function useSendCheckIn() {
  const app = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [note, setNote] = useState('');
  const inFlight = useRef(false);
  async function send(
    preset: Preset,
    options: {
      /** Who a Lock Screen or notification request named. Arrive keeps one person, so it's unused. */
      recipientId?: string;
      /** Opened from the Lock Screen reminder or its notification. */
      fromReminder?: boolean;
      /** The "Homebound" message: a departure, so it never marks where you are. */
      coming?: boolean;
      /** The "Leaving" message: also a departure. */
      leaving?: boolean;
    } = {},
  ) {
    if (inFlight.current) return;
    setError('');
    setNote('');
    // Arrive keeps one person, and every check-in goes to them. (An older reminder may still
    // name someone who has since been replaced; it goes to your person all the same.)
    const person = app.people[0];
    if (!person) {
      setError('Add your person first, so Arrive knows who to text.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    let sent = false;
    try {
      // Not awaited: Messages opens first, and the Lock Screen catches up in the background.
      if (options.fromReminder) void markCheckingIn().catch(() => null);
      const result = await openComposer(person.phone, preset.message);
      const entry = historyForResult(result, {
        id: Crypto.randomUUID(),
        recipientName: person.name,
        presetName: preset.name,
        icon: preset.icon,
        color: preset.color,
        preparedText: preset.message.trim(),
        timestamp: new Date().toISOString(),
      });
      // Cancelling in Messages records nothing.
      if (!entry) return;
      try {
        await app.recordHistory(entry);
      } catch {
        setNote(
          result === 'sent'
            ? 'Sent, but Arrive couldn’t add it to your history. No need to send it again.'
            : 'Arrive could not save this attempt. Check Messages to see whether you sent it.',
        );
        if (result === 'sent') await confirmSend(entry).catch(() => {});
        return;
      }
      if (result === 'sent') {
        sent = true;
        const departing = !!(options.coming || options.leaving);
        // An arrival makes where you are the temporary anchor, replacing the last one; leaving
        // it later is a Smart Check-In trigger. Leaving and Homebound only finish the old one.
        // Not awaited: a precise fix can take a few seconds.
        if (departing) void clearAnchor(app.places).catch(() => {});
        else if (app.prefs.smartCheckIn && app.prefs.departureReminders)
          void anchorHere(app.places).catch(() => {});
        // Leaving or Homebound means a second check-in is due when you get there ("Made it?"
        // if you stop moving, when that's on). Any arrival means you've told them, so a pending
        // arrival notification is withdrawn too.
        void (departing ? watchForArrival() : stopWatchingForArrival()).catch(() => {});
        await Promise.allSettled([
          departing ? Promise.resolve() : markManualArrival(preset.id),
          confirmSend(entry),
          // The new check-in replaces whatever reminder came before, on the one Lock Screen
          // banner: Leaving/Homebound after an arrival; your check-ins after a departure.
          afterCheckIn(
            departing
              ? { kind: options.leaving ? 'leaving' : 'homebound' }
              : { kind: 'arrival', presetId: preset.id, name: preset.name },
          ),
        ]);
      } else setNote('Messages didn’t confirm it was sent. Check Messages to make sure it went.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      // Not sent: the reminder stays on the Lock Screen.
      if (options.fromReminder && !sent) await cancelCheckingIn().catch(() => {});
      inFlight.current = false;
      setBusy(false);
    }
  }
  const clearError = useCallback(() => setError(''), []);
  const clearNote = useCallback(() => setNote(''), []);
  return { send, busy, error, note, clearError, clearNote };
}
