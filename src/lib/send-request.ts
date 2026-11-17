// A check-in someone asked to send from outside Home (the Lock Screen reminder, the widget or
// a notification). Home picks it up and opens Messages; if Home isn't mounted yet, the
// request waits until it is.

export type SendRequest = {
  /** The check-in to send, or "" for none. */
  presetId: string;
  /** No check-in named: send the default one, if there is one. */
  useDefault?: boolean;
  recipientId?: string;
  fromReminder?: boolean;
  /** "Coming" from the Lock Screen: the heading-home message instead of a check-in. */
  coming?: boolean;
  /** The banner's call button: phone this person instead of sending a check-in. */
  call?: boolean;
};

let pending: SendRequest | null = null;
let listener: ((r: SendRequest) => void) | null = null;
let atLaunch = false;

export function requestSend(r: SendRequest) {
  if (listener) listener(r);
  else {
    pending = r;
    atLaunch = true;
  }
}
/** A send was asked for before Home was up: Arrive was launched to send a check-in. */
export const sendRequestedAtLaunch = () => atLaunch;
/** Home listens here. Returns a function that stops listening. */
export function onSendRequest(fn: (r: SendRequest) => void) {
  listener = fn;
  if (pending) {
    const r = pending;
    pending = null;
    fn(r);
  }
  return () => {
    if (listener === fn) listener = null;
  };
}

/** Reads a check-in link's query ("preset=gym&quick=1&from=reminder") into a request. */
export function sendRequestFromQuery(query: Record<string, string | undefined>): SendRequest {
  // An uncertain arrival chooses no destination; the person picks one on Home.
  const choose = query.choose === '1';
  if (query.call === '1')
    return {
      presetId: '',
      call: true,
      recipientId: query.recipient || undefined,
      fromReminder: query.from === 'reminder',
    };
  return {
    presetId: choose ? '' : query.preset || '',
    useDefault: !choose && !query.preset && query.coming !== '1' && query.quick === '1',
    ...(query.coming === '1' && !choose ? { coming: true } : {}),
    recipientId: query.recipient || undefined,
    fromReminder: query.from === 'reminder',
  };
}

/**
 * Picks the query out of a check-in link, or returns null for any other link. Accepts
 * "arrive://check-in?…", "/check-in?…" and "check-in?…". Parsed by hand: it runs before
 * the app starts, and must never throw.
 */
export function checkInLinkQuery(link: string): Record<string, string> | null {
  const [head, search = ''] = link.split('?');
  const route = head.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+|\/+$/g, '');
  if (route !== 'check-in') return null;
  const query: Record<string, string> = {};
  for (const pair of search.split('#')[0].split('&')) {
    if (!pair) continue;
    const [key, value = ''] = pair.split('=');
    try {
      query[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    } catch {
      // A malformed pair is skipped.
    }
  }
  return query;
}

/** A tel: link for a saved number, or null when it has no digits to dial. */
export function telUrl(phone: string) {
  const number = phone.replace(/[^\d+*#]/g, '');
  return /\d/.test(number) ? `tel:${number}` : null;
}
