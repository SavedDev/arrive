import { body, HttpError, json, method } from './http';
import { randomToken, sha256 } from './crypto';
import type { Env } from './types';

export type Device = { id: string; smart_enabled: number; platform: 'ios' | 'android' };
export async function register(request: Request, env: Env) {
  method(request, 'POST');
  const input = await body<{ secret?: string; platform?: string }>(request);
  if (
    !input.secret ||
    input.secret.length < 40 ||
    !['ios', 'android'].includes(input.platform ?? '')
  )
    throw new HttpError(400, 'Invalid registration');
  const id = crypto.randomUUID(),
    now = Date.now();
  await env.DB.prepare(
    'INSERT INTO devices(id, auth_hash, platform, created_at, last_seen_at) VALUES(?,?,?,?,?)',
  )
    .bind(id, await sha256(input.secret), input.platform, now, now)
    .run();
  return json({ deviceId: id }, 201);
}
export async function authenticate(request: Request, env: Env): Promise<Device> {
  const match = /^Bearer ([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,})$/.exec(
    request.headers.get('authorization') ?? '',
  );
  if (!match) throw new HttpError(401, 'Unauthorized');
  const device = await env.DB.prepare(
    'SELECT id, smart_enabled, platform FROM devices WHERE id=? AND auth_hash=?',
  )
    .bind(match[1], await sha256(match[2]))
    .first<Device>();
  if (!device) throw new HttpError(401, 'Unauthorized');
  await env.DB.prepare('UPDATE devices SET last_seen_at=? WHERE id=?')
    .bind(Date.now(), device.id)
    .run();
  return device;
}
export async function createCredentials() {
  return { secret: randomToken() };
}
