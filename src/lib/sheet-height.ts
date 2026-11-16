// The settings bottom sheet reports how tall it is, so the screen underneath can make room
// and keep what's being changed in view above it (Home does this for Appearance).

let listener: ((height: number) => void) | null = null;

export function reportSheetHeight(height: number) {
  listener?.(height);
}
/** Hears the next sheet's height. Returns a function that stops listening. */
export function onSheetHeight(fn: (height: number) => void) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

let closingListener: (() => void) | null = null;
/** The sheet has started closing, so the screen underneath can move back in step with it. */
export function reportSheetClosing() {
  closingListener?.();
}
/** Hears the sheet start closing. Returns a function that stops listening. */
export function onSheetClosing(fn: () => void) {
  closingListener = fn;
  return () => {
    if (closingListener === fn) closingListener = null;
  };
}
