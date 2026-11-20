import { useSyncExternalStore } from 'react';
import { Share, type ShareContent } from 'react-native';

// True while the share sheet is open, so Screen can cover the page (see useSharing).
let sharing = false;
// Which share sheet is current, so a late callback from an old one can't end a newer one.
let session = 0;
const listeners = new Set<() => void>();
function setSharing(value: boolean) {
  sharing = value;
  listeners.forEach((listener) => listener());
}
/** Ends this share sheet's turn after delay ms, unless another one has opened since. */
function endSharing(mine: number, delay: number) {
  setTimeout(() => {
    if (session === mine && sharing) setSharing(false);
  }, delay);
}

/**
 * Opens the share sheet, unless one is already open. On iOS, the tap that dismisses the share
 * sheet also reaches whatever is underneath, so while it's open Screen covers the page with
 * useSharing: that tap only closes the sheet.
 */
export async function share(content: ShareContent) {
  if (sharing) return;
  const mine = ++session;
  setSharing(true);
  try {
    await Share.share(content);
  } finally {
    // iOS can report the sheet closed a second or two after it's gone; whichever comes first,
    // this or shareSheetTapped, frees the page.
    endSharing(mine, 100);
  }
}

/**
 * The page was tapped while the share sheet was open: that tap is closing the sheet, so the
 * page is free again once the sheet has slid away.
 */
export function shareSheetTapped() {
  endSharing(session, 350);
}

/** Whether the share sheet is open. */
export function useSharing() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => sharing,
    () => false,
  );
}
