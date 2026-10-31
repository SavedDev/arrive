import type { IconName } from './types';
// The icon sheet hands its choice back to the editor that opened it.
// Only one editor is open at a time, so a single listener is enough.
let listener: ((icon: IconName) => void) | null = null;
export function onIconPicked(fn: (icon: IconName) => void) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
export function pickIcon(icon: IconName) {
  listener?.(icon);
}
