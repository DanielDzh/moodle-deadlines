-- Short-lived abuse counters. The bucket is a keyed hash of (route, client address, hour), never the address itself;
-- the hash changes every hour, so counters cannot be linked across hours, and rows are deleted after two hours.
CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  window INTEGER NOT NULL,   -- start of the hour, Unix seconds
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window)
);
