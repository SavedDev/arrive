// The temporary Check-In Anchor: after an arrival check-in is sent, where you are becomes one
// short-lived geofence. Leaving it is a Smart Check-In trigger, and that Smart Check-In offers
// "Coming". Pure rules only, so they can be unit tested; storage and geofencing live in
// location.ts.

export type Anchor = {
  id: string;
  latitude: number;
  longitude: number;
  /** Metres. Wide enough that GPS drift doesn't look like leaving. */
  radius: number;
  createdAt: number;
  /** Set once its exit was handled, so a repeated OS event can't start a second session. */
  exitedAt?: number;
};

/** The geofence identifier for the anchor. Places use UUIDs, so this can't collide. */
export const ANCHOR_REGION = 'arrive-anchor';
/** A fix worse than this isn't good enough to mark where you are. */
export const MAX_ANCHOR_ACCURACY_M = 65;
const MIN_RADIUS_M = 150,
  MAX_RADIUS_M = 400;
/** An "exit" this soon after checking in is drift from the fix settling, not leaving. */
export const ANCHOR_SETTLE_MS = 3 * 60_000;
/** An anchor nobody left in this long is dropped rather than watched forever. */
export const ANCHOR_LIFETIME_MS = 18 * 60 * 60_000;

export const acceptableFix = (accuracy: number | null | undefined) =>
  typeof accuracy === 'number' && accuracy >= 0 && accuracy <= MAX_ANCHOR_ACCURACY_M;

/** iOS region monitoring is coarse; a radius of a few times the fix's error avoids false exits. */
export const anchorRadius = (accuracy: number) =>
  Math.round(Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, accuracy * 3 + 50)));

export function distanceM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180,
    dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(x));
}

type Region = { latitude: number; longitude: number; radius: number; enabled: boolean };
/**
 * Checking in at a remembered place (say, Home) needs no anchor: that place already watches
 * for you leaving, and a second overlapping region would report the same exit twice.
 */
export const insideRememberedPlace = (
  at: { latitude: number; longitude: number },
  radius: number,
  places: Region[],
) => places.some((p) => p.enabled && distanceM(at, p) < p.radius + radius);

/** Whether an exit from this anchor should start Smart Check-In. */
export function anchorExitCounts(anchor: Anchor | null, now: number) {
  if (!anchor || anchor.exitedAt) return false;
  const age = now - anchor.createdAt;
  return age >= ANCHOR_SETTLE_MS && age <= ANCHOR_LIFETIME_MS;
}
