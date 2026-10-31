-- Smart Check-In: one schedule per device, fed by two triggers (going separate ways from a
-- paired person, and leaving a remembered place). Nothing here identifies a person or place.

-- Days Smart Check-In may start, as a bitmask: bit 0 = Sunday … bit 6 = Saturday.
ALTER TABLE devices ADD COLUMN active_days INTEGER NOT NULL DEFAULT 127;
-- IANA time zone name, so "Monday" means the phone's Monday.
ALTER TABLE devices ADD COLUMN time_zone TEXT;
-- When this device last got a Smart Check-In, so two triggers never start two.
ALTER TABLE devices ADD COLUMN last_reminder_at INTEGER;

-- A departure from a remembered place. The phone sends only an opaque event id and the delay:
-- no location, place name or contact.
CREATE TABLE departure_sessions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'delivered', 'cancelled', 'failed', 'skipped')),
  due_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (device_id, event_id)
);
CREATE INDEX departure_sessions_device ON departure_sessions(device_id, status);
