import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushToStartPayload } from '../src/apns';

test('push-to-start payload matches expo-widgets ActivityKit content state', () => {
  const payload = pushToStartPayload('session-1', 42);
  assert.equal(payload.aps.event, 'start');
  assert.equal(payload.aps['attributes-type'], 'LiveActivityAttributes');
  assert.equal(payload.aps.timestamp, 42);
  assert.equal(typeof payload.aps['content-state'].props, 'string');
  // The layout name the app registers; anything else draws nothing on the Lock Screen.
  assert.equal(payload.aps['content-state'].name, 'ArriveReminder');
  assert.deepEqual(JSON.parse(payload.aps['content-state'].props), {
    phase: 'active',
    design: 'soft',
    title: 'Went separate ways? Check in.',
    checkInUrl: 'arrive://check-in?from=reminder&quick=1&session=session-1',
    // The same dismiss link the app's own reminder uses (src/app/reminder.tsx).
    dismissUrl: 'arrive://reminder?action=dismiss',
    places: [],
    interactive: true,
  });
});

test('a departure gets its own wording in the same Smart Check-In banner', () => {
  const payload = pushToStartPayload('session-2', 42, 'departure');
  assert.equal(payload.aps['content-state'].name, 'ArriveReminder');
  assert.equal(
    JSON.parse(payload.aps['content-state'].props).title,
    'Heading somewhere? Check in.',
  );
});

test('Coming is in the pushed banner only for a departure from the last check-in spot', () => {
  const props = (coming: boolean) =>
    JSON.parse(pushToStartPayload('s', 1, 'departure', coming).aps['content-state'].props);
  assert.equal(props(false).coming, undefined);
  assert.equal(
    props(true).coming.url,
    'arrive://check-in?from=reminder&quick=1&coming=1&session=s',
  );
  // Separation never offers it.
  assert.equal(JSON.parse(pushToStartPayload('s', 1).aps['content-state'].props).coming, undefined);
});
