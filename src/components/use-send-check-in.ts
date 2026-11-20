import { useCallback, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { historyForResult } from '@/lib/composer';
import { errorMessage } from '@/lib/domain';
import { anchorHere, clearAnchor, markManualArrival } from '@/lib/location';
import { openComposer } from '@/lib/messaging';
import { confirmSend } from '@/lib/notifications';
import { cancelCheckingIn, completeReminder, markCheckingIn } from '@/lib/reminder-runtime';
import type { Preset } from '@/lib/types';
import { useApp } from '@/state/app';

/**
 * "Coming": the heading-home message Smart Check-In offers after you leave where you last
 * checked in. Not one of the check-ins on Home, and not the same as Home (an arrival).
 */
export const comingPreset = (message: string): Preset => ({
  id: 'coming',
  name: 'Coming',
  icon: 'walk',
  color: 'mint',
  message,
  recipientId: '',
  favorite: false,
  order: -1,
});

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
      /** The "Coming" message: a departure, so it never marks where you are. */
      coming?: boolean;
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
            ? 'Messages reported a send action, but Arrive could not save it to local history. Do not resend unless you intend another message.'
            : 'Arrive could not save this attempt. Check Messages to see whether you sent it.',
        );
        if (result === 'sent') await confirmSend(entry, app.prefs).catch(() => {});
        return;
      }
      if (result === 'sent') {
        sent = true;
        // An arrival makes where you are the temporary anchor, replacing the last one; leaving
        // it later is a Smart Check-In trigger. "Coming" only finishes the old one. Not
        // awaited: a precise fix can take a few seconds.
        if (options.coming) void clearAnchor(app.places).catch(() => {});
        else if (app.prefs.smartCheckIn && app.prefs.departureReminders)
          void anchorHere(app.places).catch(() => {});
        await Promise.allSettled([
          options.coming ? Promise.resolve() : markManualArrival(preset.id),
          confirmSend(entry, app.prefs),
          // A confirmed send ends whatever reminder is showing, however the check-in started.
          completeReminder(),
        ]);
      } else
        setNote(
          'Messages opened, but Arrive cannot verify whether you sent the check-in. Check your messaging app. History marks this as unverified.',
        );
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
