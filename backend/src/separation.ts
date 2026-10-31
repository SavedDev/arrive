import { SEPARATION } from './config';
import type { LocationFix, ProximityRecord } from './types';

const radians = (value: number) => (value * Math.PI) / 180;
export function distanceMeters(a: LocationFix, b: LocationFix) {
  const radius = 6_371_000;
  const latitude = radians(b.latitude - a.latitude);
  const longitude = radians(b.longitude - a.longitude);
  const x =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitude / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function evaluateSeparation(
  previous: ProximityRecord,
  first: LocationFix | null,
  second: LocationFix | null,
  now: number,
) {
  const unusable =
    !first ||
    !second ||
    now - first.capturedAt > SEPARATION.maxLocationAgeMs ||
    now - second.capturedAt > SEPARATION.maxLocationAgeMs ||
    first.accuracy > SEPARATION.maxHorizontalAccuracyM ||
    second.accuracy > SEPARATION.maxHorizontalAccuracyM;
  if (unusable)
    return {
      ...previous,
      state: 'unknown' as const,
      evidenceStartedAt: null,
      evidenceCount: 0,
      distance: null,
    };

  const distance = distanceMeters(first, second);
  const uncertainty = first.accuracy + second.accuracy;
  if (distance + uncertainty <= SEPARATION.togetherUpperBoundM) {
    return {
      state: 'together' as const,
      evidenceStartedAt: null,
      evidenceCount: 0,
      lastTogetherAt: now,
      distance,
    };
  }
  if (distance - uncertainty < SEPARATION.separatedLowerBoundM || previous.state === 'unknown') {
    return {
      ...previous,
      state: previous.state === 'separated' ? ('separated' as const) : ('unknown' as const),
      evidenceStartedAt: null,
      evidenceCount: 0,
      distance,
    };
  }
  if (previous.state === 'separated') return { ...previous, distance };
  if (previous.state === 'possiblySeparated' && previous.evidenceStartedAt != null) {
    const evidenceCount = previous.evidenceCount + 1;
    return {
      ...previous,
      state:
        evidenceCount >= SEPARATION.requiredFarSamples &&
        now - previous.evidenceStartedAt >= SEPARATION.sustainedForMs
          ? ('separated' as const)
          : ('possiblySeparated' as const),
      evidenceCount,
      distance,
    };
  }
  return previous.state === 'together'
    ? {
        ...previous,
        state: 'possiblySeparated' as const,
        evidenceStartedAt: now,
        evidenceCount: 1,
        distance,
      }
    : {
        ...previous,
        state: 'unknown' as const,
        evidenceStartedAt: null,
        evidenceCount: 0,
        distance,
      };
}
