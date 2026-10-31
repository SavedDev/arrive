import type { Device } from './auth';
import { body, HttpError, json, method } from './http';
import type { Env } from './types';

export async function updatePushTokens(request: Request, device: Device, env: Env) {
  method(request, 'PUT');
  const input = await body<{
    apnsToken?: string | null;
    liveActivityToken?: string | null;
    environment?: string;
  }>(request);
  const valid = (value: unknown) =>
    value == null || (typeof value === 'string' && /^[A-Fa-f0-9]{32,256}$/.test(value));
  if (
    !valid(input.apnsToken) ||
    !valid(input.liveActivityToken) ||
    !['sandbox', 'production'].includes(input.environment ?? '')
  )
    throw new HttpError(400, 'Invalid push token');
  await env.DB.prepare(
    `UPDATE devices SET apns_token=COALESCE(?,apns_token),
    live_activity_token=COALESCE(?,live_activity_token),apns_environment=?,last_seen_at=? WHERE id=?`,
  )
    .bind(
      input.apnsToken ?? null,
      input.liveActivityToken ?? null,
      input.environment,
      Date.now(),
      device.id,
    )
    .run();
  return json({ ok: true });
}
