-- "Remind me later" in the bot: the task is skipped by the planner until this Unix time.
ALTER TABLE tasks ADD COLUMN snooze_until INTEGER NOT NULL DEFAULT 0;
