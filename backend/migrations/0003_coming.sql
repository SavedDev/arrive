-- "coming": the departure was from the spot of the last check-in, so the Live Activity offers
-- the Coming shortcut. Carries no location or place.
ALTER TABLE departure_sessions ADD COLUMN context TEXT CHECK (context IN ('coming'));
