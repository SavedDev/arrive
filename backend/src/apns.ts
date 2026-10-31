import { base64url, pemBytes } from './crypto';
import type { Env } from './types';

type PushTarget = {
  id: string;
  apnsToken: string | null;
  liveActivityToken: string | null;
  apnsEnvironment: 'sandbox' | 'production' | null;
};

let cachedJwt: { value: string; createdAt: number } | null = null;

async function providerToken(env: Env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.createdAt < 45 * 60) return cachedJwt.value;
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: env.APNS_KEY_ID }));
  const claims = base64url(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: now }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemBytes(env.APNS_PRIVATE_KEY),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const value = `${header}.${claims}.${base64url(new Uint8Array(signature))}`;
  cachedJwt = { value, createdAt: now };
  return value;
}

async function send(
  env: Env,
  target: PushTarget,
  token: string,
  type: 'alert' | 'liveactivity',
  payload: unknown,
  collapseId: string,
) {
  const sandbox = target.apnsEnvironment
    ? target.apnsEnvironment === 'sandbox'
    : env.APNS_USE_SANDBOX === 'true';
  const topic =
    type === 'liveactivity' ? `${env.APNS_BUNDLE_ID}.push-type.liveactivity` : env.APNS_BUNDLE_ID;
  const response = await fetch(
    `https://${sandbox ? 'api.sandbox' : 'api'}.push.apple.com/3/device/${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: {
        authorization: `bearer ${await providerToken(env)}`,
        'apns-push-type': type,
        'apns-topic': topic,
        'apns-priority': '10',
        'apns-collapse-id': collapseId.slice(0, 64),
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const reason = await response.text();
    const error = new Error(`APNs ${response.status}: ${reason.slice(0, 160)}`);
    Object.assign(error, { retryable: response.status === 429 || response.status >= 500 });
    throw error;
  }
}

export type Trigger = 'separation' | 'departure';
const TITLES: Record<Trigger, string> = {
  separation: 'Went separate ways? Check in.',
  departure: 'Heading somewhere? Check in.',
};
export function pushToStartPayload(
  sessionId: string,
  timestamp: number,
  trigger: Trigger = 'separation',
  coming = false,
) {
  return {
    aps: {
      timestamp,
      event: 'start',
      'attributes-type': 'LiveActivityAttributes',
      // Tapping the banner opens Home, like the app's own reminder.
      attributes: { url: `arrive://check-in?from=reminder&session=${sessionId}` },
      'content-state': {
        // Must match createLiveActivity('ArriveReminder', …) in src/widgets/ReminderActivity.tsx,
        // or iOS has no layout to draw. The app adopts this activity when it next runs and
        // redraws it with the person's own check-ins and design.
        name: 'ArriveReminder',
        // expo-widgets stores props as a JSON string in ActivityKit's ContentState.
        props: JSON.stringify({
          phase: 'active',
          design: 'soft',
          title: TITLES[trigger],
          // No shortcuts yet (the server never learns check-ins), so the banner shows one
          // Check In button that opens Messages with the default check-in.
          checkInUrl: `arrive://check-in?from=reminder&quick=1&session=${sessionId}`,
          dismissUrl: 'arrive://reminder?action=dismiss',
          places: [],
          // Only after leaving where the last check-in was sent: "Coming", shown first.
          ...(coming
            ? {
                coming: {
                  url: `arrive://check-in?from=reminder&quick=1&coming=1&session=${sessionId}`,
                },
              }
            : {}),
          // Push-to-start needs iOS 17.2+, where ✕ ends the reminder without opening Arrive.
          interactive: true,
        }),
      },
      // Shown as the Live Activity's own alert when it starts, not a separate banner.
      alert: { title: 'Time to check in?', body: 'A quick check-in would make their day.' },
    },
  };
}

export async function deliverReminder(
  env: Env,
  target: PushTarget,
  sessionId: string,
  trigger: Trigger = 'separation',
  coming = false,
) {
  if (target.liveActivityToken) {
    try {
      await send(
        env,
        target,
        target.liveActivityToken,
        'liveactivity',
        pushToStartPayload(sessionId, Math.floor(Date.now() / 1000), trigger, coming),
        sessionId,
      );
      return 'liveactivity' as const;
    } catch (error) {
      if ((error as { retryable?: boolean }).retryable || !target.apnsToken) throw error;
    }
  }
  if (!target.apnsToken) throw new Error('No APNs token is registered');
  await send(
    env,
    target,
    target.apnsToken,
    'alert',
    {
      aps: {
        alert: { title: 'Time to check in?', body: 'A quick check-in would make their day.' },
        category: 'ARRIVAL',
        sound: 'default',
      },
      reminder: '1',
      smartReminder: '1',
      sessionId,
    },
    sessionId,
  );
  return 'notification' as const;
}
