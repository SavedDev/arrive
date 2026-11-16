import type { Place, Preset, Visit } from './types';
export const suggestedMessage = (name: string) =>
  name.trim() ? `I've arrived at ${name.trim()}! ❤️` : "I've arrived safely! ❤️";
export function validatePreset(p: Pick<Preset, 'name' | 'message'>) {
  if (!p.name.trim() || p.name.trim().length > 40)
    throw new Error('Give your check-in a name of 1–40 characters.');
  if (!p.message.trim() || p.message.trim().length > 500)
    throw new Error('Write a message of 1–500 characters.');
}
export const sortedPresets = (p: Preset[]) =>
  [...p].sort(
    (a, b) => Number(b.id === 'elsewhere') - Number(a.id === 'elsewhere') || a.order - b.order,
  );
export const MIN_ACTIVITY_SHORTCUTS = 2;
export const MAX_ACTIVITY_SHORTCUTS = 4;
export function activityPresets(presets: Preset[], order: string[]) {
  const available = new Map(sortedPresets(presets).map((preset) => [preset.id, preset]));
  const ordered = order.flatMap((id) => {
    const preset = available.get(id);
    if (!preset) return [];
    available.delete(id);
    return [preset];
  });
  return [...ordered, ...available.values()];
}
/** Favorites choose membership; saved banner order chooses placement. */
export function activityShortcuts(presets: Preset[], order: string[]) {
  const ordered = activityPresets(presets, order);
  const favoriteIds = new Set(
    ordered
      .filter((preset) => preset.favorite)
      .slice(0, MAX_ACTIVITY_SHORTCUTS)
      .map((p) => p.id),
  );
  const count = Math.min(
    MAX_ACTIVITY_SHORTCUTS,
    Math.max(MIN_ACTIVITY_SHORTCUTS, favoriteIds.size),
  );
  const selected = new Set(favoriteIds);
  for (const preset of ordered) {
    if (selected.size >= count) break;
    selected.add(preset.id);
  }
  return ordered.filter((preset) => selected.has(preset.id)).slice(0, MAX_ACTIVITY_SHORTCUTS);
}
export function distance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function arrivalDecision(
  place: Place,
  places: Place[],
  visit: Visit | null,
  now: number,
  fix?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
    speed: number | null;
  },
) {
  if (
    !place.enabled ||
    visit?.inside ||
    (visit?.lastAction && now - visit.lastAction < 30 * 60000) ||
    (visit?.exitedAt && now - visit.exitedAt < 10 * 60000)
  )
    return 'ignore';
  const overlaps = places.some(
    (p) => p.enabled && p.id !== place.id && distance(p, place) <= p.radius + place.radius + 50,
  );
  if (overlaps) return 'ambiguous';
  // Never infer a specific destination from a missing, stale or imprecise fix.
  if (
    !fix ||
    fix.accuracy < 0 ||
    fix.accuracy > 50 ||
    now - fix.timestamp > 30000 ||
    fix.timestamp > now + 1000 ||
    distance(fix, place) + fix.accuracy > place.radius
  )
    return 'ambiguous';
  return 'ask';
}
export function validCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}
export function singleFlight<T extends unknown[], R>(fn: (...args: T) => Promise<R>) {
  let pending: Promise<R> | null = null;
  return (...args: T): Promise<R> => {
    if (pending) return pending;
    pending = fn(...args).finally(() => {
      pending = null;
    });
    return pending;
  };
}
export const errorMessage = (e: unknown) =>
  e instanceof Error
    ? e.message
    : typeof e === 'object' && e && 'message' in e
      ? String(e.message)
      : 'Something went wrong. Please try again.';
