import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createComposer, historyForResult } from '../src/lib/composer';
import { decodePerson, encodePerson, normalizePhone } from '../src/lib/people';
import { recentHistory, latestSent, HISTORY_TTL } from '../src/lib/history';
import { invitationMessage } from '../src/lib/invitation';
import type { HistoryEntry } from '../src/lib/types';
const now = Date.parse('2026-09-22T18:00:00Z');
const draft = {
  id: 'one',
  recipientName: 'Sarah',
  presetName: 'Gym',
  icon: 'gym',
  color: 'mint',
  preparedText: 'Arrived!',
  timestamp: new Date(now).toISOString(),
} as const;
test('phone numbers are normalized, validated and never guessed from a region', () => {
  assert.equal(normalizePhone('+1 (312) 555-0123'), '+13125550123');
  for (const bad of ['3125550123', '+123', '+13125550123;evil', '+13125550123 ext 4'])
    assert.throws(() => normalizePhone(bad));
});
test('QR round trip contains only a version and chosen name/phone', () => {
  const raw = encodePerson({ name: ' Sarah ', phone: '+1 (312) 555-0123' });
  assert.deepEqual(JSON.parse(raw), { version: 1, name: 'Sarah', phone: '+13125550123' });
  assert.deepEqual(decodePerson(raw), { name: 'Sarah', phone: '+13125550123' });
});
test('Smart Reminder QR adds only a temporary anonymous pairing token', () => {
  const token = 'a'.repeat(43);
  const raw = encodePerson({ name: 'Sarah', phone: '+13125550123' }, token);
  assert.deepEqual(JSON.parse(raw), {
    version: 2,
    name: 'Sarah',
    phone: '+13125550123',
    pairToken: token,
  });
  assert.deepEqual(decodePerson(raw), {
    name: 'Sarah',
    phone: '+13125550123',
    pairToken: token,
  });
});
test('QR import rejects malformed, oversized, unsupported and unexpected data', () => {
  for (const raw of [
    'https://example.com',
    '[]',
    'null',
    'x'.repeat(513),
    JSON.stringify({ version: 2, name: 'Sarah', phone: '+13125550123' }),
    JSON.stringify({ version: 1, name: 'Sarah', phone: 'bad' }),
    JSON.stringify({ version: 1, name: 'Sarah', phone: '+13125550123', redirect: 'evil' }),
    JSON.stringify({ version: 1, name: '\nSarah', phone: '+13125550123' }).replace(
      '\\nSarah',
      'Sarah\\nEvil',
    ),
  ])
    assert.throws(() => decodePerson(raw));
});
test('composer uses normalized phone and prepared text and suppresses concurrent opens', async () => {
  let opens = 0;
  let finish!: (value: { result: 'sent' }) => void;
  const send = createComposer({
    isAvailableAsync: async () => true,
    sendSMSAsync: async (phones, message) => {
      opens++;
      assert.deepEqual(phones, ['+13125550123']);
      assert.equal(message, 'Arrived!');
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const a = send('+1 (312) 555-0123', ' Arrived! '),
    b = send('+13125550123', 'Arrived!');
  assert.equal(a, b);
  await Promise.resolve();
  assert.equal(opens, 1);
  finish({ result: 'sent' });
  assert.equal(await a, 'sent');
});
test('unsupported messaging never opens or records a success', async () => {
  const send = createComposer({
    isAvailableAsync: async () => false,
    sendSMSAsync: async () => {
      throw new Error('must not open');
    },
  });
  await assert.rejects(send('+13125550123', 'Hi'), /unavailable/);
});
test('cancelled attempts are excluded; unknown attempts never become successful history', () => {
  assert.equal(historyForResult('cancelled', draft), null);
  const unknown = historyForResult('unknown', draft)!;
  assert.equal(unknown.status, 'unknown');
  assert.equal(latestSent([unknown], now), undefined);
  assert.equal(historyForResult('sent', draft)?.status, 'sent');
});
test('history strictly expires at 72 hours in UTC, orders newest first and rejects invalid dates', () => {
  const entry = (id: string, age: number, status: 'sent' | 'unknown' = 'sent'): HistoryEntry => ({
    ...draft,
    id,
    status,
    timestamp: new Date(now - age).toISOString(),
  });
  const list = [
    entry('old', HISTORY_TTL),
    entry('recent', 1000),
    entry('unknown', 0, 'unknown'),
    entry('keep', HISTORY_TTL - 1),
    entry('future', -1),
    { ...draft, id: 'invalid', status: 'sent' as const, timestamp: 'bad' },
  ];
  assert.deepEqual(
    recentHistory(list, now).map((e) => e.id),
    ['unknown', 'recent', 'keep'],
  );
  assert.equal(latestSent(list, now)?.id, 'recent');
  assert.equal(list.length, 6);
});
test('invitations accurately describe installed-app links and reject URL payloads', () => {
  assert.match(invitationMessage(), /only if you already have/);
  assert.match(invitationMessage('https://example.com/arrive'), /https:\/\/example.com\/arrive/);
  for (const url of [
    'https://example.com/?phone=123',
    'https://example.com/#phone=123',
    'http://example.com',
    'https://name:password@example.com',
  ]) {
    const message = invitationMessage(url);
    assert.match(message, /arrive:\/\/people/);
    assert.ok(!message.includes(url));
  }
});

import {
  CHECKING_IN_TIMEOUT,
  REMINDER_LIFETIME,
  createReminder,
  reconcile,
  transition,
} from '../src/lib/reminder';
const on = { running: 0, supported: true, enabled: true };
test('a departure reminder waits out its delay, then asks to start one Live Activity', () => {
  const r = createReminder(
    { id: 'visit-1', source: 'departure', placeName: 'Home' },
    now,
    5 * 60000,
  );
  assert.equal(r.phase, 'scheduled');
  assert.equal(reconcile(r, now + 60000, on).action, 'none');
  const due = reconcile(r, now + 5 * 60000, on);
  assert.equal(due.action, 'start');
  assert.equal(due.reminder?.phase, 'active');
  const shown = transition(due.reminder!, { type: 'activate', activityId: 'a1' }, now);
  assert.equal(reconcile(shown, now + 6 * 60000, { ...on, running: 1 }).action, 'update');
});
test('cancelling Messages keeps the reminder; only a confirmed send completes it', () => {
  const active = createReminder({ id: 'm', source: 'manual' }, now);
  const checking = transition(active, { type: 'checkIn' }, now);
  assert.equal(checking.phase, 'checkingIn');
  assert.equal(transition(checking, { type: 'cancelCheckIn' }, now).phase, 'active');
  const done = transition(checking, { type: 'complete' }, now);
  assert.equal(done.phase, 'completed');
  assert.equal(transition(done, { type: 'activate' }, now).phase, 'completed');
});
test('dismissed and expired reminders end any Live Activity and never restart', () => {
  const shown = transition(
    createReminder({ id: 'd', source: 'manual' }, now),
    { type: 'activate', activityId: 'a' },
    now,
  );
  const dismissed = transition(shown, { type: 'dismiss' }, now);
  assert.deepEqual(reconcile(dismissed, now, { ...on, running: 1 }).action, 'endAll');
  assert.equal(reconcile(dismissed, now, on).action, 'none');
  const late = reconcile(shown, now + REMINDER_LIFETIME + 1, { ...on, running: 1 });
  assert.equal(late.reminder?.phase, 'expired');
  assert.equal(late.action, 'endAll');
});
test('a Live Activity removed from the Lock Screen counts as dismissed', () => {
  const shown = transition(
    createReminder({ id: 'r', source: 'manual' }, now),
    { type: 'activate', activityId: 'a' },
    now,
  );
  const gone = reconcile(shown, now + 1000, on);
  assert.equal(gone.reminder?.phase, 'dismissed');
  assert.equal(gone.action, 'none');
});
test('without Live Activities the reminder still activates, with no activity calls', () => {
  const r = createReminder({ id: 'n', source: 'departure' }, now, 60000);
  const due = reconcile(r, now + 60000, { running: 0, supported: false, enabled: true });
  assert.equal(due.reminder?.phase, 'active');
  assert.equal(due.action, 'none');
  const off = reconcile(r, now + 60000, { running: 1, supported: true, enabled: false });
  assert.equal(off.action, 'endAll');
});
test('a stuck check-in returns to active, and coming back withdraws only a pending reminder', () => {
  const checking = transition(
    createReminder({ id: 's', source: 'manual' }, now),
    { type: 'checkIn' },
    now,
  );
  assert.equal(
    reconcile(checking, now + CHECKING_IN_TIMEOUT + 1, { ...on, running: 1 }).reminder?.phase,
    'active',
  );
  const pending = createReminder({ id: 'p', source: 'departure', placeId: 'home' }, now, 60000);
  assert.equal(transition(pending, { type: 'cancel' }, now).phase, 'inactive');
  assert.equal(transition(checking, { type: 'cancel' }, now).phase, 'checkingIn');
});

test('check-in links become send requests; other links are left alone', async () => {
  const { checkInLinkQuery, sendRequestFromQuery } = await import('../src/lib/send-request');
  const place = checkInLinkQuery('arrive://check-in?from=reminder&quick=1&preset=gym');
  assert.deepEqual(sendRequestFromQuery(place!), {
    presetId: 'gym',
    useDefault: false,
    recipientId: undefined,
    fromReminder: true,
  });
  // The widget and the banner itself name no check-in: Home just opens.
  assert.deepEqual(sendRequestFromQuery(checkInLinkQuery('arrive://check-in')!), {
    presetId: '',
    useDefault: false,
    recipientId: undefined,
    fromReminder: false,
  });
  // "Check In" with no places sends the default check-in.
  assert.equal(
    sendRequestFromQuery(checkInLinkQuery('arrive://check-in?from=reminder&quick=1')!).useDefault,
    true,
  );
  // An uncertain arrival never picks a destination.
  assert.equal(
    sendRequestFromQuery(checkInLinkQuery('/check-in?choose=1&preset=gym')!).presetId,
    '',
  );
  assert.equal(checkInLinkQuery('check-in?preset=my%20gym&recipient=a+b')!.preset, 'my gym');
  assert.equal(checkInLinkQuery('check-in?preset=my%20gym&recipient=a+b')!.recipient, 'a b');
  assert.equal(checkInLinkQuery('check-in?preset=%E0%A4%A')!.preset, undefined);
  for (const other of [
    'arrive://reminder?action=dismiss',
    '/widget',
    'arrive://',
    '',
    'https://x.y/check-in-now',
  ])
    assert.equal(checkInLinkQuery(other), null);
});

test('Smart Check-In: one schedule and switch for both triggers', async () => {
  const { activeOn, daysMask, departureTriggerOn, needsSmartService, separationTriggerOn } =
    await import('../src/lib/smart-checkin');
  const weekdays = { smartCheckIn: true, activeDays: [1, 2, 3, 4, 5] };
  const monday = new Date(2026, 8, 28, 9, 0);
  const saturday = new Date(2026, 9, 3, 9, 0);
  assert.equal(activeOn(weekdays, monday), true);
  // Saturday is off: a trigger that day does nothing.
  assert.equal(activeOn(weekdays, saturday), false);
  assert.equal(activeOn({ ...weekdays, smartCheckIn: false }, monday), false);
  assert.equal(daysMask([0, 1, 2, 3, 4, 5, 6]), 127);
  assert.equal(daysMask([1, 5]), 0b100010);
  assert.equal(daysMask([7, -1]), 0);
  const on = { smartCheckIn: true, departureReminders: true, smartReminders: false };
  assert.equal(departureTriggerOn(on, [{ enabled: true }]), true);
  // No remembered place, nothing to leave.
  assert.equal(departureTriggerOn(on, [{ enabled: false }]), false);
  assert.equal(separationTriggerOn(on), false);
  assert.equal(separationTriggerOn({ ...on, smartReminders: true }), true);
  // Turning Smart Check-In off silences both triggers and stops using the service.
  const off = { ...on, smartCheckIn: false, smartReminders: true };
  assert.equal(needsSmartService(off, [{ enabled: true }]), false);
  assert.equal(needsSmartService(on, []), false);
});

test('temporary anchor: a good fix, a drift-proof radius, once per exit', async () => {
  const { ANCHOR_SETTLE_MS, acceptableFix, anchorExitCounts, anchorRadius, insideRememberedPlace } =
    await import('../src/lib/anchor');
  assert.equal(acceptableFix(20), true);
  // A rough fix isn't a place to anchor to.
  assert.equal(acceptableFix(120), false);
  assert.equal(acceptableFix(null), false);
  // Never smaller than iOS can reliably watch, and wider for a looser fix.
  assert.equal(anchorRadius(5), 150);
  assert.equal(anchorRadius(60), 230);
  assert.equal(anchorRadius(10_000), 400);
  const gym = { id: 'a', latitude: 41.88, longitude: -87.63, radius: 150, createdAt: 0 };
  // Drift right after checking in isn't leaving.
  assert.equal(anchorExitCounts(gym, ANCHOR_SETTLE_MS - 1), false);
  assert.equal(anchorExitCounts(gym, ANCHOR_SETTLE_MS + 1), true);
  // A repeated exit event for the same anchor starts nothing new.
  assert.equal(anchorExitCounts({ ...gym, exitedAt: 1 }, ANCHOR_SETTLE_MS + 1), false);
  assert.equal(anchorExitCounts(null, ANCHOR_SETTLE_MS + 1), false);
  // Checking in at a remembered Home needs no second, overlapping region.
  const home = { latitude: 41.9, longitude: -87.65, radius: 150, enabled: true };
  assert.equal(insideRememberedPlace({ latitude: 41.9001, longitude: -87.65 }, 150, [home]), true);
  assert.equal(insideRememberedPlace(gym, 150, [home]), false);
  assert.equal(
    insideRememberedPlace({ latitude: 41.9001, longitude: -87.65 }, 150, [
      { ...home, enabled: false },
    ]),
    false,
  );
});

test('"Coming" links are their own request, never the Home check-in', async () => {
  const { checkInLinkQuery, sendRequestFromQuery } = await import('../src/lib/send-request');
  const coming = sendRequestFromQuery(
    checkInLinkQuery('arrive://check-in?from=reminder&quick=1&coming=1')!,
  );
  assert.equal(coming.coming, true);
  assert.equal(coming.presetId, '');
  // It doesn't fall back to the default check-in.
  assert.equal(coming.useDefault, false);
  const home = sendRequestFromQuery(
    checkInLinkQuery('arrive://check-in?from=reminder&quick=1&preset=home')!,
  );
  assert.equal(home.coming, undefined);
  assert.equal(home.presetId, 'home');
});
