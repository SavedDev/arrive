import { MAX_CLOCK_SKEW_MS } from './config';
import { body, HttpError, json, method } from './http';
import { evaluateSeparation } from './separation';
import type { Device } from './auth';
import type { Env, LocationFix, ProximityRecord } from './types';

type LocationRow = { latitude: number; longitude: number; accuracy: number; captured_at: number };
const fix = (row?: LocationRow | null): LocationFix | null =>
  row && [row.latitude, row.longitude, row.accuracy, row.captured_at].every(Number.isFinite)
    ? {
        latitude: row.latitude,
        longitude: row.longitude,
        accuracy: row.accuracy,
        capturedAt: row.captured_at,
      }
    : null;
export async function updateLocation(request: Request, device: Device, env: Env) {
  method(request, 'PUT');
  if (!device.smart_enabled) throw new HttpError(409, 'Smart Reminders are disabled');
  const input = await body<LocationFix & { signal?: string }>(request),
    now = Date.now();
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180 ||
    !Number.isFinite(input.accuracy) ||
    input.accuracy < 0 ||
    input.accuracy > 10_000 ||
    !Number.isFinite(input.capturedAt) ||
    Math.abs(now - input.capturedAt) > MAX_CLOCK_SKEW_MS
  )
    throw new HttpError(400, 'Invalid location');
  const signal = ['movement', 'accuracy', 'geofenceExit', 'foreground'].includes(input.signal ?? '')
    ? input.signal!
    : 'movement';
  const membership = await env.DB.prepare(
    `SELECT p.id pairId,p.reminder_delay_minutes delayMinutes
    FROM pair_members pm JOIN pairs p ON p.id=pm.pair_id WHERE pm.device_id=? AND p.status='active'`,
  )
    .bind(device.id)
    .first<{ pairId: string; delayMinutes: number }>();
  if (!membership) throw new HttpError(409, 'Device is not paired');
  await env.DB.prepare(
    "DELETE FROM reminder_sessions WHERE pair_id=? AND status!='scheduled' AND updated_at<?",
  )
    .bind(membership.pairId, now - 24 * 60 * 60_000)
    .run();
  await env.DB.prepare(
    `INSERT INTO device_location_state(device_id,latitude,longitude,accuracy,captured_at,received_at,signal)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,
    accuracy=excluded.accuracy,captured_at=excluded.captured_at,received_at=excluded.received_at,signal=excluded.signal
    WHERE excluded.captured_at >= device_location_state.captured_at`,
  )
    .bind(device.id, input.latitude, input.longitude, input.accuracy, input.capturedAt, now, signal)
    .run();
  const locations = await env.DB.prepare(
    `SELECT l.latitude,l.longitude,l.accuracy,l.captured_at
    FROM pair_members pm LEFT JOIN device_location_state l ON l.device_id=pm.device_id
    WHERE pm.pair_id=? ORDER BY pm.joined_at`,
  )
    .bind(membership.pairId)
    .all<LocationRow>();
  const stored = await env.DB.prepare(
    `SELECT state,evidence_started_at evidenceStartedAt,evidence_count evidenceCount,
    last_together_at lastTogetherAt FROM pair_proximity_state WHERE pair_id=?`,
  )
    .bind(membership.pairId)
    .first<ProximityRecord>();
  const previous = stored ?? {
    state: 'unknown',
    evidenceStartedAt: null,
    evidenceCount: 0,
    lastTogetherAt: null,
  };
  const next = evaluateSeparation(
    previous,
    fix(locations.results[0]),
    fix(locations.results[1]),
    now,
  );
  await env.DB.prepare(
    `INSERT INTO pair_proximity_state(pair_id,state,evidence_started_at,evidence_count,last_distance,last_together_at,evaluated_at)
    VALUES(?,?,?,?,?,?,?) ON CONFLICT(pair_id) DO UPDATE SET state=excluded.state,evidence_started_at=excluded.evidence_started_at,
    evidence_count=excluded.evidence_count,last_distance=excluded.last_distance,last_together_at=excluded.last_together_at,evaluated_at=excluded.evaluated_at`,
  )
    .bind(
      membership.pairId,
      next.state,
      next.evidenceStartedAt,
      next.evidenceCount,
      next.distance,
      next.lastTogetherAt,
      now,
    )
    .run();
  if (next.state === 'together' || next.state === 'unknown')
    await env.DB.prepare(
      "UPDATE reminder_sessions SET status='cancelled',updated_at=? WHERE pair_id=? AND status='scheduled'",
    )
      .bind(now, membership.pairId)
      .run();
  if (next.state === 'separated' && previous.state !== 'separated') {
    const id = crypto.randomUUID(),
      delaySeconds = membership.delayMinutes * 60;
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO reminder_sessions(id,pair_id,status,separated_at,due_at,created_at,updated_at)
      VALUES(?,?,'scheduled',?,?,?,?)`,
    )
      .bind(id, membership.pairId, now, now + delaySeconds * 1000, now, now)
      .run();
    if (result.meta.changes) await env.REMINDERS.send({ sessionId: id }, { delaySeconds });
  }
  return json({ state: next.state, acceptedAt: now });
}
