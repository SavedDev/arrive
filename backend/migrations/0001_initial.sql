PRAGMA foreign_keys = ON;

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  auth_hash TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  smart_enabled INTEGER NOT NULL DEFAULT 0 CHECK (smart_enabled IN (0, 1)),
  apns_token TEXT,
  live_activity_token TEXT,
  apns_environment TEXT CHECK (apns_environment IN ('sandbox', 'production')),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE pairs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected')),
  reminder_delay_minutes INTEGER NOT NULL CHECK (reminder_delay_minutes IN (1, 5, 10)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE pair_members (
  pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (pair_id, device_id)
);

CREATE TABLE pairing_invites (
  token_hash TEXT PRIMARY KEY,
  creator_device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  reminder_delay_minutes INTEGER NOT NULL CHECK (reminder_delay_minutes IN (1, 5, 10)),
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE device_location_state (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL NOT NULL,
  captured_at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  signal TEXT NOT NULL
);

CREATE TABLE pair_proximity_state (
  pair_id TEXT PRIMARY KEY REFERENCES pairs(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('unknown', 'together', 'possiblySeparated', 'separated')),
  evidence_started_at INTEGER,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_distance REAL,
  last_together_at INTEGER,
  evaluated_at INTEGER NOT NULL
);

CREATE TABLE reminder_sessions (
  id TEXT PRIMARY KEY,
  pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'delivered', 'cancelled', 'failed')),
  separated_at INTEGER NOT NULL,
  due_at INTEGER NOT NULL,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE reminder_deliveries (
  session_id TEXT NOT NULL REFERENCES reminder_sessions(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed')),
  delivered_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, device_id)
);

CREATE UNIQUE INDEX one_scheduled_reminder_per_pair
  ON reminder_sessions(pair_id) WHERE status = 'scheduled';
CREATE INDEX pairing_invites_expiry ON pairing_invites(expires_at);
CREATE INDEX reminder_sessions_due ON reminder_sessions(status, due_at);
