import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSeparation } from '../src/separation';
import type { LocationFix, ProximityRecord } from '../src/types';

const now = Date.parse('2026-09-25T12:00:00Z');
const unknown: ProximityRecord = {
  state: 'unknown',
  evidenceStartedAt: null,
  evidenceCount: 0,
  lastTogetherAt: null,
};
const fix = (longitude: number, accuracy = 10, capturedAt = now): LocationFix => ({
  latitude: 41.88,
  longitude,
  accuracy,
  capturedAt,
});

test('together requires overlapping reliable positions', () => {
  assert.equal(evaluateSeparation(unknown, fix(-87.63), fix(-87.6302), now).state, 'together');
});
test('one far point never confirms separation and unknown cannot jump to separated', () => {
  assert.equal(evaluateSeparation(unknown, fix(-87.63), fix(-87.64), now).state, 'unknown');
  const together = evaluateSeparation(unknown, fix(-87.63), fix(-87.6302), now);
  assert.equal(
    evaluateSeparation(together, fix(-87.63), fix(-87.64), now).state,
    'possiblySeparated',
  );
});
test('both phones can leave together without becoming separated', () => {
  const together = evaluateSeparation(unknown, fix(-87.63), fix(-87.6302), now);
  const later = evaluateSeparation(
    together,
    { ...fix(-87.61, 10, now + 120_000), latitude: 41.9 },
    { ...fix(-87.6102, 10, now + 120_000), latitude: 41.9 },
    now + 120_000,
  );
  assert.equal(later.state, 'together');
});
test('sustained reliable distance confirms separation and reunion cancels it', () => {
  const together = evaluateSeparation(unknown, fix(-87.63), fix(-87.6302), now);
  const possible = evaluateSeparation(together, fix(-87.63), fix(-87.64), now + 1_000);
  const separated = evaluateSeparation(
    possible,
    fix(-87.63, 10, now + 122_000),
    fix(-87.64, 10, now + 122_000),
    now + 122_000,
  );
  assert.equal(separated.state, 'separated');
  assert.equal(
    evaluateSeparation(
      separated,
      fix(-87.63, 10, now + 123_000),
      fix(-87.6301, 10, now + 123_000),
      now + 123_000,
    ).state,
    'together',
  );
});
test('poor or stale fixes are unknown, never separated', () => {
  const together = evaluateSeparation(unknown, fix(-87.63), fix(-87.6302), now);
  assert.equal(evaluateSeparation(together, fix(-87.63, 250), fix(-87.64), now).state, 'unknown');
  assert.equal(
    evaluateSeparation(together, fix(-87.63, 10, now - 600_000), fix(-87.64), now).state,
    'unknown',
  );
});
