-- When the user was warned that their subscription will be removed for inactivity (0 = never).
-- The warning is repeated only after a new visit to the site resets last_seen_at.
ALTER TABLE users ADD COLUMN inactivity_warned_at INTEGER NOT NULL DEFAULT 0;
