import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_DAYS,
  DUPLICATE_WINDOW_MS,
  activeOn,
  recentlyReminded,
  validDays,
  validTimeZone,
  weekdayIn,
} from '../src/schedule';

// Monday 2026-09-28 at 03:30 UTC, which is still Sunday evening (22:30) in Chicago.
const mondayUtc = Date.parse('2026-09-28T03:30:00Z');
const bit = (day: number) => 1 << day;

test('the active day is the phone’s own day, not UTC’s', () => {
  assert.equal(weekdayIn('UTC', mondayUtc), 1);
  assert.equal(weekdayIn('America/Chicago', mondayUtc), 0);
  assert.equal(activeOn(bit(1), 'UTC', mondayUtc), true);
  assert.equal(activeOn(bit(1), 'America/Chicago', mondayUtc), false);
  assert.equal(activeOn(bit(0), 'America/Chicago', mondayUtc), true);
});

test('a day that is off does nothing; every day on always passes', () => {
  const weekdaysOnly = ALL_DAYS & ~bit(0) & ~bit(6);
  const saturday = Date.parse('2026-10-03T15:00:00Z');
  assert.equal(activeOn(weekdaysOnly, 'UTC', saturday), false);
  assert.equal(activeOn(ALL_DAYS, 'UTC', saturday), true);
  assert.equal(activeOn(0, 'UTC', saturday), false);
  // An unknown zone falls back to UTC instead of failing.
  assert.equal(activeOn(bit(6), 'Not/AZone', saturday), true);
});

test('a second trigger inside the window never starts a second Live Activity', () => {
  const now = Date.parse('2026-09-28T12:00:00Z');
  assert.equal(recentlyReminded(null, now), false);
  assert.equal(recentlyReminded(now - 60_000, now), true);
  assert.equal(recentlyReminded(now - DUPLICATE_WINDOW_MS - 1, now), false);
});

test('schedule input is validated', () => {
  assert.equal(validDays(ALL_DAYS), true);
  assert.equal(validDays(128), false);
  assert.equal(validDays(-1), false);
  assert.equal(validDays(1.5), false);
  assert.equal(validTimeZone('America/Chicago'), true);
  assert.equal(validTimeZone('Nowhere/Land'), false);
  assert.equal(validTimeZone(5), false);
});
