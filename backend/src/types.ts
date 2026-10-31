export type Proximity = 'unknown' | 'together' | 'possiblySeparated' | 'separated';
export type LocationFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
};
export type ProximityRecord = {
  state: Proximity;
  evidenceStartedAt: number | null;
  evidenceCount: number;
  lastTogetherAt: number | null;
};
export type Env = {
  DB: D1Database;
  REMINDERS: Queue<ReminderMessage>;
  APNS_TEAM_ID: string;
  APNS_KEY_ID: string;
  APNS_PRIVATE_KEY: string;
  APNS_BUNDLE_ID: string;
  APNS_USE_SANDBOX?: string;
  DEVELOPMENT_MODE?: string;
};
/** A Smart Check-In waiting to start. Separation sessions predate `kind`, so it's optional. */
export type ReminderMessage = { sessionId: string; kind?: 'separation' | 'departure' };
