-- The bot's "Already done" button now sets the same `done` flag as the tick on the site,
-- so the site can show it. Carry over what the old button had muted.
UPDATE tasks SET done = 1, muted = 0 WHERE muted = 1;
