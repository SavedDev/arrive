import { deliverReminder, type Trigger } from './apns';
import { activeOn, recentlyReminded } from './schedule';
import type { Env, ReminderMessage } from './types';

type Target = {
  id: string;
  apnsToken: string | null;
  liveActivityToken: string | null;
  apnsEnvironment: 'sandbox' | 'production' | null;
  smartEnabled: number;
  activeDays: number;
  timeZone: string | null;
  lastReminderAt: number | null;
  deliveryStatus?: string | null;
};
const TARGET = `d.id,d.apns_token apnsToken,d.live_activity_token liveActivityToken,
  d.apns_environment apnsEnvironment,d.smart_enabled smartEnabled,d.active_days activeDays,
  d.time_zone timeZone,d.last_reminder_at lastReminderAt`;

/**
 * Starts one Smart Check-In on a device, whichever trigger asked. Every trigger passes the
 * same checks: an active day on that phone, and no Smart Check-In in the last few minutes,
 * so two triggers for one outing never start two Live Activities.
 */
async function startCheckIn(
  env: Env,
  target: Target,
  sessionId: string,
  triggeredAt: number,
  trigger: Trigger,
  coming = false,
) {
  const now = Date.now();
  if (!activeOn(target.activeDays, target.timeZone, triggeredAt)) return 'skipped' as const;
  if (recentlyReminded(target.lastReminderAt, now)) return 'skipped' as const;
  await deliverReminder(env, target, sessionId, trigger, coming);
  await env.DB.prepare('UPDATE devices SET last_reminder_at=? WHERE id=?')
    .bind(now, target.id)
    .run();
  return 'delivered' as const;
}

async function departure(message: Message<ReminderMessage>, env: Env) {
  const now = Date.now();
  const session = await env.DB.prepare(
    `SELECT s.id,s.due_at dueAt,s.created_at createdAt,s.context,${TARGET}
    FROM departure_sessions s JOIN devices d ON d.id=s.device_id
    WHERE s.id=? AND s.status='scheduled'`,
  )
    .bind(message.body.sessionId)
    .first<Target & { dueAt: number; createdAt: number; context: string | null }>();
  if (!session) return message.ack();
  if (session.dueAt > now + 1_000)
    return message.retry({ delaySeconds: Math.ceil((session.dueAt - now) / 1000) });
  let status: 'delivered' | 'skipped' | 'failed';
  try {
    status = await startCheckIn(
      env,
      session,
      message.body.sessionId,
      session.createdAt,
      'departure',
      session.context === 'coming',
    );
  } catch (error) {
    if ((error as { retryable?: boolean }).retryable) return message.retry({ delaySeconds: 60 });
    status = 'failed';
  }
  await env.DB.prepare('UPDATE departure_sessions SET status=?,updated_at=? WHERE id=?')
    .bind(status, Date.now(), message.body.sessionId)
    .run();
  message.ack();
}

async function separation(message: Message<ReminderMessage>, env: Env) {
  const now = Date.now();
  const session = await env.DB.prepare(
    `SELECT rs.id,rs.pair_id pairId,rs.due_at dueAt,rs.separated_at separatedAt,ps.state
    FROM reminder_sessions rs LEFT JOIN pair_proximity_state ps ON ps.pair_id=rs.pair_id
    WHERE rs.id=? AND rs.status='scheduled'`,
  )
    .bind(message.body.sessionId)
    .first<{ id: string; pairId: string; dueAt: number; separatedAt: number; state: string }>();
  if (!session) return message.ack();
  // Back together before the delay ran out: nothing to remind about.
  if (session.state !== 'separated') {
    await env.DB.prepare("UPDATE reminder_sessions SET status='cancelled',updated_at=? WHERE id=?")
      .bind(now, session.id)
      .run();
    return message.ack();
  }
  if (session.dueAt > now + 1_000)
    return message.retry({ delaySeconds: Math.ceil((session.dueAt - now) / 1000) });
  const targets = await env.DB.prepare(
    `SELECT ${TARGET},rd.status deliveryStatus
    FROM pair_members pm JOIN devices d ON d.id=pm.device_id
    LEFT JOIN reminder_deliveries rd ON rd.session_id=? AND rd.device_id=d.id WHERE pm.pair_id=?`,
  )
    .bind(session.id, session.pairId)
    .all<Target>();
  let retry = false,
    delivered = false;
  // Each phone follows its own schedule: one person's day off doesn't silence the other.
  for (const target of targets.results) {
    if (target.deliveryStatus === 'delivered') {
      delivered = true;
      continue;
    }
    if (!target.smartEnabled) continue;
    try {
      if (
        (await startCheckIn(env, target, session.id, session.separatedAt, 'separation')) !==
        'delivered'
      )
        continue;
      delivered = true;
      await env.DB.prepare(
        `INSERT INTO reminder_deliveries(session_id,device_id,status,delivered_at,updated_at)
        VALUES(?,?,'delivered',?,?) ON CONFLICT(session_id,device_id) DO UPDATE SET status='delivered',delivered_at=excluded.delivered_at,updated_at=excluded.updated_at`,
      )
        .bind(session.id, target.id, Date.now(), Date.now())
        .run();
    } catch (error) {
      retry ||= !!(error as { retryable?: boolean }).retryable;
      await env.DB.prepare(
        `INSERT INTO reminder_deliveries(session_id,device_id,status,updated_at)
        VALUES(?,?,'failed',?) ON CONFLICT(session_id,device_id) DO UPDATE SET status='failed',updated_at=excluded.updated_at`,
      )
        .bind(session.id, target.id, Date.now())
        .run();
    }
  }
  if (retry) return message.retry({ delaySeconds: 60 });
  await env.DB.prepare(
    'UPDATE reminder_sessions SET status=?,delivered_at=?,updated_at=? WHERE id=?',
  )
    .bind(
      delivered ? 'delivered' : 'cancelled',
      delivered ? Date.now() : null,
      Date.now(),
      session.id,
    )
    .run();
  message.ack();
}

export async function consumeReminders(batch: MessageBatch<ReminderMessage>, env: Env) {
  for (const message of batch.messages)
    await (message.body.kind === 'departure' ? departure(message, env) : separation(message, env));
}
