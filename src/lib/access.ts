import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';
import { cachedAccessValid } from './paywall';
import { entitlement, purchases } from './purchases';
import { read, write } from './storage';

// Arrive needs Arrive Plus: a free trial or a paid subscription. Without it, the app shows the
// paywall and its background features (Smart Check-In, reminders) stay off.
//
// The store is the source of truth. The last answer is cached so background tasks, which can't
// wait on the network, and an offline launch still know; the cache honours the expiry date.

export type Access = 'checking' | 'active' | 'none';
type Cache = { active: boolean; expiresAt: number | null };
const CACHE = 'access-cache';

let current: Access = 'checking';
const listeners = new Set<(a: Access) => void>();
function publish(next: Access) {
  current = next;
  listeners.forEach((fn) => fn(next));
}

function fromInfo(info: CustomerInfo): Cache {
  const ent = info.entitlements.active[entitlement];
  return {
    active: !!ent,
    expiresAt: ent?.expirationDate ? Date.parse(ent.expirationDate) : null,
  };
}
async function save(info: CustomerInfo) {
  const cache = fromInfo(info);
  await write(CACHE, cache);
  return cache.active;
}

/** The web build is a local preview with no store, so it isn't gated. */
const ungated = Platform.OS === 'web';

/** Asks the store, falling back to the cached answer when it can't be reached. */
export async function refreshAccess(): Promise<boolean> {
  let active: boolean;
  if (ungated) active = true;
  else {
    try {
      const p = await purchases();
      active = await save(await p.getCustomerInfo());
    } catch {
      active = cachedAccessValid(await read<Cache | null>(CACHE, null), Date.now());
    }
  }
  publish(active ? 'active' : 'none');
  return active;
}

/** For background tasks: the last known answer, without touching the network. */
export async function hasAccessCached() {
  if (ungated) return true;
  return cachedAccessValid(await read<Cache | null>(CACHE, null), Date.now());
}

/** After a purchase or restore: record what the store said and unlock straight away. */
export async function acceptCustomerInfo(info: CustomerInfo) {
  const active = await save(info);
  publish(active ? 'active' : 'none');
  return active;
}

/** Whether Arrive Plus is active, kept current as the app returns to the foreground. */
export function useAccess() {
  const [access, setAccess] = useState<Access>(current);
  useEffect(() => {
    listeners.add(setAccess);
    void refreshAccess();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAccess();
    });
    // Renewals, refunds and expiries the store reports while Arrive is open.
    let stop: (() => void) | undefined;
    if (!ungated)
      void purchases()
        .then((p) => {
          const onInfo = (info: CustomerInfo) => void acceptCustomerInfo(info);
          p.addCustomerInfoUpdateListener(onInfo);
          stop = () => p.removeCustomerInfoUpdateListener(onInfo);
        })
        .catch(() => {});
    return () => {
      listeners.delete(setAccess);
      sub.remove();
      stop?.();
    };
  }, []);
  return access;
}
