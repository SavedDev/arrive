import type { ComposerResult, HistoryEntry } from './types';
import { singleFlight } from './domain';
import { normalizePhone } from './people';

type NativeComposer = {
  isAvailableAsync: () => Promise<boolean>;
  sendSMSAsync: (addresses: string[], message: string) => Promise<{ result: ComposerResult }>;
};
// One process-wide composer. Tests inject the native boundary; production always uses expo-sms.
export function createComposer(native: NativeComposer) {
  return singleFlight(async (phone: string, text: string): Promise<ComposerResult> => {
    const address = normalizePhone(phone);
    if (!text.trim() || text.trim().length > 500)
      throw new Error('Write a message of 1–500 characters.');
    if (!(await native.isAvailableAsync()))
      throw new Error(
        'Messaging is unavailable on this device. Open Arrive on a phone with messaging set up. Your check-in has not been sent.',
      );
    const { result } = await native.sendSMSAsync([address], text.trim());
    return result === 'sent' || result === 'cancelled' ? result : 'unknown';
  });
}
export function historyForResult(
  result: ComposerResult,
  draft: Omit<HistoryEntry, 'status'>,
): HistoryEntry | null {
  return result === 'cancelled' ? null : { ...draft, status: result };
}
