import type { Device } from './auth';
import { body, HttpError, json } from './http';
import { validDays, validTimeZone } from './schedule';
import type { Env } from './types';

const delay = (value: unknown) => {
  if (value !== 1 && value !== 5 && value !== 10)
    throw new HttpError(400, 'Delay must be 1, 5 or 10 minutes');
  return value;
};

/** PUT /v1/checkin/settings: the phone's active days and time zone. */
export async function checkInSettings(request: Request, device: Device, env: Env) {
  if (request.method !== 'PUT') throw new HttpError(405, 'Method not allowed');
  const input = await body<{ activeDays?: unknown; timeZone?: unknown }>(request);
  if (!validDays(input.activeDays) || !validTimeZone(input.timeZone))
    throw new HttpError(400, 'Invalid schedule');
  await env.DB.prepare('UPDATE devices SET active_days=?,time_zone=? WHERE id=?')
    .bind(input.activeDays, input.timeZone, device.id)
    .run();
  return json({ ok: true });
}

/**
 * POST /v1/checkin/departure: the phone left a remembered place on an active day. Starts its
 * Live Activity by push after the delay, because iOS won't let an app start one from the
 * background. DELETE cancels (the person came back, or already checked in).
 */
export async function departure(request: Request, device: Device, env: Env) {
  const now = Date.now();
  if (request.method === 'DELETE') {
    await env.DB.prepare(
      "UPDATE departure_sessions SET status='cancelled',updated_at=? WHERE device_id=? AND status='scheduled'",
    )
      .bind(now, device.id)
      .run();
    return json({ ok: true });
  }
  if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed');
  const input = await body<{ eventId?: unknown; delayMinutes?: unknown; context?: unknown }>(
    request,
  );
  if (input.context != null && input.context !== 'coming')
    throw new HttpError(400, 'Invalid context');
  if (typeof input.eventId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(input.eventId))
    throw new HttpError(400, 'Invalid event');
  const minutes = delay(input.delayMinutes);
  const target = await env.DB.prepare('SELECT live_activity_token token FROM devices WHERE id=?')
    .bind(device.id)
    .first<{ token: string | null }>();
  // Without a push-to-start token there's no way to start the Live Activity; the phone shows
  // its one fallback notification instead.
  if (!target?.token) throw new HttpError(409, 'Live Activity unavailable');
  const id = crypto.randomUUID();
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO departure_sessions(id,device_id,event_id,status,due_at,created_at,updated_at,context)
    VALUES(?,?,?,'scheduled',?,?,?,?)`,
  )
    .bind(
      id,
      device.id,
      input.eventId,
      now + minutes * 60_000,
      now,
      now,
      input.context === 'coming' ? 'coming' : null,
    )
    .run();
  if (result.meta.changes)
    await env.REMINDERS.send({ sessionId: id, kind: 'departure' }, { delaySeconds: minutes * 60 });
  return json({ scheduled: true }, 201);
}
