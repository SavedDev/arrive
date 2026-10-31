export const SEPARATION = {
  maxLocationAgeMs: 5 * 60_000,
  maxHorizontalAccuracyM: 100,
  togetherUpperBoundM: 100,
  separatedLowerBoundM: 250,
  sustainedForMs: 2 * 60_000,
  requiredFarSamples: 2,
} as const;

export const INVITE_TTL_MS = 10 * 60_000;
export const MAX_CLOCK_SKEW_MS = 10 * 60_000;
