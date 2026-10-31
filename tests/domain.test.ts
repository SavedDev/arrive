import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arrivalDecision,
  activityPresets,
  activityShortcuts,
  distance,
  singleFlight,
  sortedPresets,
  suggestedMessage,
  validCoordinates,
  validatePreset,
} from '../src/lib/domain';
import { initialPresets, type Place, type Visit } from '../src/lib/types';
const place: Place = {
  id: 'home',
  name: 'Home',
  address: 'Home',
  latitude: 41,
  longitude: -87,
  radius: 150,
  presetId: 'home',
  recipientId: 'person',
  enabled: true,
  departureReminder: true,
};
const now = Date.now();
const visit: Visit = {
  inside: false,
  lastAction: now - 3600000,
  exitedAt: now - 1800000,
  visitId: 'old',
};
const fix = { latitude: 41, longitude: -87, accuracy: 10, timestamp: now, speed: 0 };
test('presets work without physical destinations; validate names and messages', () => {
  initialPresets.forEach(validatePreset);
  assert.throws(() => validatePreset({ name: ' ', message: 'hi' }));
  assert.throws(() => validatePreset({ name: 'Gym', message: ' ' }));
  assert.throws(() => validatePreset({ name: 'Gym', message: 'x'.repeat(501) }));
  assert.equal(suggestedMessage(' Gym '), "I've arrived at Gym! ❤️");
});
test('favorites never reorder My check-ins and Other stays first', () => {
  const list = initialPresets.map((p) => ({ ...p, favorite: p.id === 'coffee' }));
  assert.deepEqual(
    sortedPresets(list).map((preset) => preset.id),
    ['elsewhere', 'work', 'grocery', 'home', 'gym', 'coffee'],
  );
  assert.equal(list[0].id, 'elsewhere');
});
test('activity order keeps new presets and ignores removed preset ids', () => {
  assert.deepEqual(
    activityPresets(initialPresets, ['coffee', 'missing', 'home']).map((preset) => preset.id),
    ['coffee', 'home', 'elsewhere', 'work', 'grocery', 'gym'],
  );
});
test('activity shortcuts include every favorite and adapt from two to four', () => {
  const favorite = (count: number) =>
    initialPresets.map((preset, index) => ({ ...preset, favorite: index < count }));
  assert.deepEqual(
    activityShortcuts(favorite(0), []).map((preset) => preset.id),
    ['elsewhere', 'work'],
  );
  assert.equal(activityShortcuts(favorite(4), []).length, 4);
  assert.equal(activityShortcuts(favorite(5), []).length, 4);
  assert.deepEqual(
    activityShortcuts(favorite(4), ['coffee', 'home', 'gym', 'grocery', 'work']).map(
      (preset) => preset.id,
    ),
    ['home', 'grocery', 'work', 'elsewhere'],
  );
});
test('a specific arrival reminder requires an isolated place and a fresh precise fix', () => {
  assert.equal(arrivalDecision(place, [place], visit, now, fix), 'ask');
  assert.equal(arrivalDecision({ ...place, enabled: false }, [place], visit, now, fix), 'ignore');
  for (const f of [
    undefined,
    { ...fix, accuracy: 100 },
    { ...fix, accuracy: -1 },
    { ...fix, timestamp: now - 60000 },
    { ...fix, latitude: 41.002 },
  ])
    assert.equal(arrivalDecision(place, [place], visit, now, f), 'ambiguous');
});
test('overlapping places ask even when one center is closer', () => {
  assert.equal(
    arrivalDecision(
      place,
      [place, { ...place, id: 'trampoline', longitude: -87.0005 }],
      visit,
      now,
      fix,
    ),
    'ambiguous',
  );
});
test('duplicate entries, short departures and cooldowns suppress repeated arrivals', () => {
  assert.equal(arrivalDecision(place, [place], { ...visit, inside: true }, now, fix), 'ignore');
  assert.equal(
    arrivalDecision(place, [place], { ...visit, exitedAt: now - 60000 }, now, fix),
    'ignore',
  );
  assert.equal(
    arrivalDecision(place, [place], { ...visit, lastAction: now - 120000 }, now, fix),
    'ignore',
  );
});
test('a fresh visit is eligible after a genuine exit and cooldown', () =>
  assert.equal(arrivalDecision(place, [place], visit, now, fix), 'ask'));
test('coordinates and distances are validated', () => {
  assert.equal(distance(place, place), 0);
  assert.ok(distance(place, { ...place, latitude: 42 }) > 110000);
  assert.equal(validCoordinates(91, 0), false);
  assert.equal(validCoordinates(NaN, 0), false);
  assert.equal(validCoordinates(0, 0), true);
});
test('rapid send requests share a single pending operation', async () => {
  let sends = 0;
  let resolve!: (n: number) => void;
  const send = singleFlight(async () => {
    sends++;
    return new Promise<number>((r) => {
      resolve = r;
    });
  });
  const first = send();
  const second = send();
  assert.equal(first, second);
  assert.equal(sends, 1);
  resolve(1);
  assert.equal(await first, 1);
});
test('a failed operation remains retryable', async () => {
  let count = 0;
  const send = singleFlight(async () => {
    if (++count === 1) throw new Error('offline');
    return 'accepted';
  });
  await assert.rejects(send(), /offline/);
  assert.equal(await send(), 'accepted');
});
