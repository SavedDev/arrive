import { INVITE_TTL_MS } from './config';
import { randomToken, sha256 } from './crypto';
import { body, HttpError, json, method } from './http';
import type { Device } from './auth';
import type { Env } from './types';

const delay = (value: unknown): 1 | 5 | 10 => {
  if (value !== 1 && value !== 5 && value !== 10)
    throw new HttpError(400, 'Invalid reminder delay');
  return value;
};
export async function pairStatus(device: Device, env: Env) {
  const row = await env.DB.prepare(
    `SELECT p.id pairId, p.reminder_delay_minutes reminderDelayMinutes,
    p.status, ps.state proximityState FROM pair_members pm JOIN pairs p ON p.id=pm.pair_id
    LEFT JOIN pair_proximity_state ps ON ps.pair_id=p.id WHERE pm.device_id=? AND p.status='active'`,
  )
    .bind(device.id)
    .first();
  return json({ enabled: !!device.smart_enabled, pair: row ?? null });
}
export async function createInvite(request: Request, device: Device, env: Env) {
  method(request, 'POST');
  const input = await body<{ reminderDelayMinutes?: number }>(request);
  const reminderDelay = delay(input.reminderDelayMinutes);
  const existing = await env.DB.prepare(
    `SELECT 1 ok FROM pair_members pm JOIN pairs p ON p.id=pm.pair_id
    WHERE pm.device_id=? AND p.status='active'`,
  )
    .bind(device.id)
    .first();
  if (existing) throw new HttpError(409, 'Disconnect the current pair first');
  const token = randomToken(),
    now = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE devices SET smart_enabled=1 WHERE id=?').bind(device.id),
    env.DB.prepare('DELETE FROM pairing_invites WHERE creator_device_id=? OR expires_at<?').bind(
      device.id,
      now,
    ),
    env.DB.prepare(
      'INSERT INTO pairing_invites(token_hash,creator_device_id,reminder_delay_minutes,expires_at) VALUES(?,?,?,?)',
    ).bind(await sha256(token), device.id, reminderDelay, now + INVITE_TTL_MS),
  ]);
  return json({ token, expiresAt: now + INVITE_TTL_MS, reminderDelayMinutes: reminderDelay }, 201);
}
export async function acceptInvite(request: Request, device: Device, env: Env) {
  method(request, 'POST');
  const input = await body<{ token?: string; reminderDelayMinutes?: number }>(request);
  if (!input.token || input.token.length < 40) throw new HttpError(400, 'Invalid invite');
  const now = Date.now(),
    hash = await sha256(input.token);
  const invite = await env.DB.prepare(
    `SELECT creator_device_id creatorDeviceId,reminder_delay_minutes reminderDelay FROM pairing_invites
    WHERE token_hash=? AND used_at IS NULL AND expires_at>?`,
  )
    .bind(hash, now)
    .first<{ creatorDeviceId: string; reminderDelay: 1 | 5 | 10 }>();
  if (!invite || invite.creatorDeviceId === device.id)
    throw new HttpError(410, 'Invite expired or invalid');
  const creator = await env.DB.prepare('SELECT smart_enabled FROM devices WHERE id=?')
    .bind(invite.creatorDeviceId)
    .first<{ smart_enabled: number }>();
  if (!creator?.smart_enabled)
    throw new HttpError(409, 'The other person must enable Smart Reminders');
  const pairId = crypto.randomUUID();
  try {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE pairing_invites SET used_at=? WHERE token_hash=? AND used_at IS NULL',
      ).bind(now, hash),
      env.DB.prepare(
        'INSERT INTO pairs(id,reminder_delay_minutes,created_at,updated_at) VALUES(?,?,?,?)',
      ).bind(pairId, invite.reminderDelay, now, now),
      env.DB.prepare('INSERT INTO pair_members(pair_id,device_id,joined_at) VALUES(?,?,?)').bind(
        pairId,
        invite.creatorDeviceId,
        now,
      ),
      env.DB.prepare('INSERT INTO pair_members(pair_id,device_id,joined_at) VALUES(?,?,?)').bind(
        pairId,
        device.id,
        now,
      ),
      env.DB.prepare(
        'INSERT INTO pair_proximity_state(pair_id,state,evaluated_at) VALUES(?,?,?)',
      ).bind(pairId, 'unknown', now),
      env.DB.prepare('UPDATE devices SET smart_enabled=1 WHERE id=?').bind(device.id),
    ]);
  } catch {
    throw new HttpError(409, 'Invite was already used or a device is already paired');
  }
  return json({ pairId }, 201);
}
export async function settings(request: Request, device: Device, env: Env) {
  method(request, 'PUT');
  const input = await body<{ enabled?: boolean; reminderDelayMinutes?: number }>(request);
  if (typeof input.enabled !== 'boolean') throw new HttpError(400, 'Invalid setting');
  const now = Date.now();
  const member = await env.DB.prepare('SELECT pair_id pairId FROM pair_members WHERE device_id=?')
    .bind(device.id)
    .first<{ pairId: string }>();
  const statements = [
    env.DB.prepare(
      // Push tokens stay: leaving a remembered place also starts Smart Check-In by push.
      'UPDATE devices SET smart_enabled=? WHERE id=?',
    ).bind(input.enabled ? 1 : 0, device.id),
  ];
  if (member && input.reminderDelayMinutes != null)
    statements.push(
      env.DB.prepare('UPDATE pairs SET reminder_delay_minutes=?,updated_at=? WHERE id=?').bind(
        delay(input.reminderDelayMinutes),
        now,
        member.pairId,
      ),
    );
  if (!input.enabled) {
    statements.push(
      env.DB.prepare('DELETE FROM device_location_state WHERE device_id=?').bind(device.id),
    );
    if (member) {
      statements.push(
        env.DB.prepare(
          "UPDATE pair_proximity_state SET state='unknown',evidence_started_at=NULL,evidence_count=0,evaluated_at=? WHERE pair_id=?",
        ).bind(now, member.pairId),
      );
      statements.push(
        env.DB.prepare(
          "UPDATE reminder_sessions SET status='cancelled',updated_at=? WHERE pair_id=? AND status='scheduled'",
        ).bind(now, member.pairId),
      );
    }
  }
  await env.DB.batch(statements);
  return json({ ok: true });
}
export async function disconnect(request: Request, device: Device, env: Env) {
  method(request, 'DELETE');
  const member = await env.DB.prepare('SELECT pair_id pairId FROM pair_members WHERE device_id=?')
    .bind(device.id)
    .first<{ pairId: string }>();
  if (member) {
    const now = Date.now();
    const members = await env.DB.prepare('SELECT device_id id FROM pair_members WHERE pair_id=?')
      .bind(member.pairId)
      .all<{ id: string }>();
    await env.DB.batch([
      env.DB.prepare("UPDATE pairs SET status='disconnected',updated_at=? WHERE id=?").bind(
        now,
        member.pairId,
      ),
      env.DB.prepare(
        'DELETE FROM device_location_state WHERE device_id IN (SELECT device_id FROM pair_members WHERE pair_id=?)',
      ).bind(member.pairId),
      env.DB.prepare(
        "UPDATE reminder_sessions SET status='cancelled',updated_at=? WHERE pair_id=? AND status='scheduled'",
      ).bind(now, member.pairId),
      env.DB.prepare(
        'DELETE FROM pairing_invites WHERE creator_device_id IN (SELECT device_id FROM pair_members WHERE pair_id=?)',
      ).bind(member.pairId),
      ...members.results.map((row) =>
        env.DB.prepare(
          // Disconnecting ends separation only; departures still need the push tokens.
          'UPDATE devices SET smart_enabled=0 WHERE id=?',
        ).bind(row.id),
      ),
      env.DB.prepare('DELETE FROM pairs WHERE id=?').bind(member.pairId),
    ]);
  }
  return json({ ok: true });
}
