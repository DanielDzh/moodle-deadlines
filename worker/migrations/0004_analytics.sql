-- First-party, anonymous usage statistics. No IP, no user agent, no link to a Moodle or Telegram account.
-- One row per (local day, local hour, anonymous browser id hash, event) with a counter.
CREATE TABLE analytics_events (
  day     TEXT NOT NULL,     -- Kyiv local date, YYYY-MM-DD
  hour    INTEGER NOT NULL,  -- Kyiv local hour, 0-23
  visitor TEXT NOT NULL,     -- first 16 hex of SHA-256 of the browser's random id; 'server' for events counted on the server
  event   TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, hour, visitor, event)
);
CREATE INDEX analytics_by_day ON analytics_events (day);
CREATE INDEX analytics_by_visitor ON analytics_events (visitor);
