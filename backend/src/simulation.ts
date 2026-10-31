import type { Device } from './auth';
import { body, HttpError, json, method } from './http';
import type { Env, Proximity } from './types';

type Scenario =
  | 'together'
  | 'oneMovingAway'
  | 'bothLeavingTogether'
  | 'laterDiverging'
  | 'stale'
  | 'poorAccuracy'
  | 'reunion'
  | 'separationConfirmed'
  | 'reminderDue'
  | 'pushToStart';
const scenarios: Scenario[] = [
  'together',
  'oneMovingAway',
  'bothLeavingTogether',
  'laterDiverging',
  'stale',
  'poorAccuracy',
  'reunion',
  'separationConfirmed',
  'reminderDue',
  'pushToStart',
];

export async function simulate(request: Request, device: Device, env: Env) {
  method(request, 'POST');
  if (env.DEVELOPMENT_MODE !== 'true') throw new HttpError(404, 'Not found');
  const input = await body<{ scenario?: Scenario }>(request);
  if (!scenarios.includes(input.scenario as Scenario))
    throw new HttpError(400, 'Invalid simulation');
  const member = await env.DB.prepare(
    `SELECT p.id pairId,p.reminder_delay_minutes delayMinutes
    FROM pair_members pm JOIN pairs p ON p.id=pm.pair_id
    WHERE pm.device_id=? AND p.status='active'`,
  )
    .bind(device.id)
    .first<{ pairId: string; delayMinutes: number }>();
  if (!member) throw new HttpError(409, 'Pair this device before running a simulation');
  const now = Date.now(),
    scenario = input.scenario!;
  const state: Proximity =
    scenario === 'oneMovingAway'
      ? 'possiblySeparated'
      : scenario === 'stale' || scenario === 'poorAccuracy'
        ? 'unknown'
        : ['laterDiverging', 'separationConfirmed', 'reminderDue', 'pushToStart'].includes(scenario)
          ? 'separated'
          : 'together';
  await env.DB.prepare(
    `INSERT INTO pair_proximity_state(pair_id,state,evidence_started_at,evidence_count,last_together_at,evaluated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(pair_id) DO UPDATE SET state=excluded.state,
    evidence_started_at=excluded.evidence_started_at,evidence_count=excluded.evidence_count,
    last_together_at=excluded.last_together_at,evaluated_at=excluded.evaluated_at`,
  )
    .bind(
      member.pairId,
      state,
      state === 'possiblySeparated' ? now : null,
      state === 'possiblySeparated' ? 1 : 0,
      state === 'together' ? now : null,
      now,
    )
    .run();
  if (state === 'together' || state === 'unknown') {
    await env.DB.prepare(
      "UPDATE reminder_sessions SET status='cancelled',updated_at=? WHERE pair_id=? AND status='scheduled'",
    )
      .bind(now, member.pairId)
      .run();
    return json({ scenario, state, scheduled: false });
  }
  if (state !== 'separated') return json({ scenario, state, scheduled: false });
  const existing = await env.DB.prepare(
    "SELECT id FROM reminder_sessions WHERE pair_id=? AND status='scheduled'",
  )
    .bind(member.pairId)
    .first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  const delaySeconds = ['reminderDue', 'pushToStart'].includes(scenario)
    ? 0
    : member.delayMinutes * 60;
  if (existing)
    await env.DB.prepare('UPDATE reminder_sessions SET due_at=?,updated_at=? WHERE id=?')
      .bind(now + delaySeconds * 1000, now, id)
      .run();
  else
    await env.DB.prepare(
      `INSERT INTO reminder_sessions(id,pair_id,status,separated_at,due_at,created_at,updated_at)
      VALUES(?,?,'scheduled',?,?,?,?)`,
    )
      .bind(id, member.pairId, now, now + delaySeconds * 1000, now, now)
      .run();
  await env.REMINDERS.send({ sessionId: id }, delaySeconds ? { delaySeconds } : undefined);
  return json({ scenario, state, scheduled: true, sessionId: id });
}
