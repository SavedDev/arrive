import { authenticate, register } from './auth';
import { HttpError, json } from './http';
import { updateLocation } from './locations';
import { checkInSettings, departure } from './checkin';
import { acceptInvite, createInvite, disconnect, pairStatus, settings } from './pairing';
import { updatePushTokens } from './push';
import { consumeReminders } from './reminders';
import { simulate } from './simulation';
import type { Env, ReminderMessage } from './types';

const notFound = () => {
  throw new HttpError(404, 'Not found');
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === '/health') return json({ ok: true });
      if (url.pathname === '/v1/devices/register') return register(request, env);
      const device = await authenticate(request, env);
      switch (url.pathname) {
        case '/v1/pair':
          return pairStatus(device, env);
        case '/v1/pair/invites':
          return createInvite(request, device, env);
        case '/v1/pair/accept':
          return acceptInvite(request, device, env);
        case '/v1/pair/settings':
          return settings(request, device, env);
        case '/v1/pair/disconnect':
          return disconnect(request, device, env);
        case '/v1/checkin/settings':
          return checkInSettings(request, device, env);
        case '/v1/checkin/departure':
          return departure(request, device, env);
        case '/v1/push-tokens':
          return updatePushTokens(request, device, env);
        case '/v1/location':
          return updateLocation(request, device, env);
        case '/v1/dev/simulate':
          return simulate(request, device, env);
        default:
          return notFound();
      }
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('request failed', error instanceof Error ? error.message : 'unknown error');
      return json({ error: 'Internal server error' }, 500);
    }
  },
  queue: consumeReminders,
} satisfies ExportedHandler<Env, ReminderMessage>;
