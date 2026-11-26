// Plain helpers for the paywall's wording, kept free of native modules so they're unit tested.

type Intro = { price: number; periodUnit: string; periodNumberOfUnits: number; cycles: number };

/** "7-day free trial" from the store's introductory offer, or null when there's no free one. */
export function trialLabel(intro: Intro | null | undefined) {
  if (!intro || intro.price !== 0) return null;
  const units = intro.periodNumberOfUnits * Math.max(1, intro.cycles);
  const unit = intro.periodUnit.toLowerCase();
  if (unit === 'day') return `${units}-day free trial`;
  if (unit === 'week') return units === 1 ? '7-day free trial' : `${units}-week free trial`;
  if (unit === 'month') return `${units}-month free trial`;
  if (unit === 'year') return `${units}-year free trial`;
  return 'Free trial';
}

/** How much cheaper a year is than twelve months, as a whole percent, or null if it isn't. */
export function yearlySavings(monthlyPrice: number, yearlyPrice: number) {
  if (!(monthlyPrice > 0) || !(yearlyPrice > 0)) return null;
  const percent = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  return percent > 0 ? percent : null;
}

/**
 * How long past its renewal date a subscription that was set to renew still counts, while Arrive
 * can't ask the store (in the background, or offline). The store renews it on that date, but
 * Arrive only hears so the next time it's opened; without this, leaving a place on a renewal
 * day (every day on TestFlight) would start nothing until Arrive was opened.
 */
export const RENEWAL_GRACE_MS = 7 * 24 * 60 * 60_000;
/** Whether a cached entitlement still counts: active, and not past its expiry (plus grace). */
export function cachedAccessValid(
  cache: { active: boolean; expiresAt: number | null; willRenew?: boolean } | null,
  now: number,
) {
  if (!cache?.active) return false;
  if (cache.expiresAt === null || cache.expiresAt > now) return true;
  return !!cache.willRenew && now < cache.expiresAt + RENEWAL_GRACE_MS;
}
