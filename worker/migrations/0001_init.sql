-- Users: Telegram binding, the Moodle token (encrypted) and settings.
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  chat_id       INTEGER UNIQUE,
  link_code     TEXT UNIQUE,
  link_expires  INTEGER,
  sync_key_hash TEXT NOT NULL,
  site          TEXT NOT NULL,
  token_enc     TEXT,
  tz            TEXT NOT NULL,
  -- pending: waiting for Start in the bot; active; paused_auth: the Moodle token is stale; stopped
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  last_fetch_at INTEGER NOT NULL DEFAULT 0,
  fetch_failures INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX users_status ON users (status, last_fetch_at);

-- Tasks: only name, course, deadline and link. No descriptions or files.
CREATE TABLE tasks (
  user_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key       TEXT NOT NULL,
  name      TEXT NOT NULL,
  course    TEXT NOT NULL,
  url       TEXT NOT NULL,
  due       INTEGER NOT NULL,
  done      INTEGER NOT NULL DEFAULT 0,
  submitted INTEGER NOT NULL DEFAULT 0,
  muted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, key)
);
CREATE INDEX tasks_due ON tasks (due);

-- Reminders already sent. The deadline is part of the key: if a teacher moves the deadline, reminders are sent again.
CREATE TABLE sent_reminders (
  user_id  TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  due      INTEGER NOT NULL,
  kind     TEXT NOT NULL,
  sent_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, task_key, due, kind)
);
