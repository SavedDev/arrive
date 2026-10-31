export async function read<T>(key: string, fallback: T): Promise<T> {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(`arrive:${key}`);
  return raw ? (JSON.parse(raw) as T) : fallback;
}
export async function write<T>(key: string, value: T) {
  localStorage.setItem(`arrive:${key}`, JSON.stringify(value));
}
export async function remove(key: string) {
  localStorage.removeItem(`arrive:${key}`);
}
export async function update<T>(key: string, fallback: T, transform: (value: T) => T): Promise<T> {
  // Synchronous localStorage read/write is atomic within this browser tab.
  const raw = localStorage.getItem(`arrive:${key}`);
  const next = transform(raw ? (JSON.parse(raw) as T) : fallback);
  localStorage.setItem(`arrive:${key}`, JSON.stringify(next));
  return next;
}

export async function clearAll() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('arrive:'))
    .forEach((k) => localStorage.removeItem(k));
}
export async function removeLegacyData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('arrive:private:') || k === 'arrive:push-token')
    .forEach((k) => localStorage.removeItem(k));
}
