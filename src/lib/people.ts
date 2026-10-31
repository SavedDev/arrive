import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import type { Person } from './types';

export function normalizePhone(value: string) {
  const raw = value.trim();
  if (!raw.startsWith('+') || !/^\+[\d\s().-]+$/.test(raw))
    throw new Error('Include the country code, for example +1 312 555 0123.');
  const phone = parsePhoneNumberFromString(raw);
  if (!phone?.isValid() || phone.ext)
    throw new Error('Enter a valid phone number with its country code.');
  return phone.number as string;
}
// Contacts often store numbers without a country code, like "(312) 555-0123".
// Read those in the phone's own region so a picked contact can be saved without editing.
export function contactPhone(value: string, region?: string) {
  const raw = value.trim();
  const phone = raw.startsWith('+')
    ? parsePhoneNumberFromString(raw)
    : region
      ? parsePhoneNumberFromString(raw, region as Parameters<typeof parsePhoneNumberFromString>[1])
      : undefined;
  return phone?.isValid() && !phone.ext ? (phone.number as string) : null;
}
export function deviceRegion() {
  try {
    const locale = new Intl.NumberFormat().resolvedOptions().locale;
    return locale.split(/[-_]/).find((part, i) => i > 0 && /^[A-Z]{2}$/.test(part));
  } catch {
    return undefined;
  }
}
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.[0];
  return (letters || '?').toUpperCase();
}
export function validatePerson(value: Pick<Person, 'name' | 'phone'>) {
  const name = value.name.trim();
  if (!name || name.length > 50 || /[\u0000-\u001f\u007f]/.test(name))
    throw new Error('Enter a name of 1–50 characters.');
  return { name, phone: normalizePhone(value.phone) };
}
export function encodePerson(value: Pick<Person, 'name' | 'phone'>, pairToken?: string) {
  return JSON.stringify(
    pairToken
      ? { version: 2, ...validatePerson(value), pairToken }
      : { version: 1, ...validatePerson(value) },
  );
}
export function decodePerson(raw: string) {
  if (raw.length > 512) throw new Error('This is not a valid Arrive contact QR.');
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('This is not an Arrive contact QR.');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![1, 2].includes(value.version) ||
    typeof value.name !== 'string' ||
    typeof value.phone !== 'string' ||
    (value.version === 2 &&
      (typeof value.pairToken !== 'string' || !/^[A-Za-z0-9_-]{40,}$/.test(value.pairToken))) ||
    Object.keys(value).some((k) => !['version', 'name', 'phone', 'pairToken'].includes(k))
  )
    throw new Error(
      'This QR format is not supported. Ask your person to create an Arrive contact QR.',
    );
  return {
    ...validatePerson(value),
    ...(value.version === 2 ? { pairToken: value.pairToken as string } : {}),
  };
}
