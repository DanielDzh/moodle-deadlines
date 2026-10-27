# Plan: deadline reminders via a Telegram bot (option A: Moodle token on the server)

Status: stages 1-4 done in code (stage 4 verified locally end to end; verify on the real deployment) (Worker skeleton, schema, token encryption, reminder planner, bot commands, site API, the reminders dialog on the site with consent, sync and logout cleanup). Next: stage 5 polish and stage 6 real-account checks.

## Decisions
- Channel: Telegram bot `@moodle_deadlines_bot`. Backend: Cloudflare Worker + D1 + cron, in `worker/` of this repository.
- The server polls Moodle by itself (a student may never open the site), so it stores the student's Moodle token (option A). The owner accepted this risk knowingly.
- Works with any Moodle, not only UBTS.
- The bot speaks Ukrainian and addresses the student formally ("ви"). Everything development-related (code, comments, tests, docs, commits) is in English.

## Token security (mandatory)
1. The token is encrypted with AES-256-GCM. The key `TOKEN_KEY` lives only in Worker secrets, never in the database. D1 holds only iv + ciphertext. A unique iv per record, the user id is bound as AAD.
2. The token is never returned to a client, never logged, never put into error messages. It is decrypted only inside the cron job.
3. Any Moodle is allowed, so instead of an allow-list the site address is strictly validated: https only, a domain name only (no IP literals, localhost, `.local`, `.internal`, non-standard ports), no redirects to other hosts, request timeouts, response size limits. This protects against SSRF, since the Worker fetches an address supplied by a user. Plus: per-user limits and a `BLOCKED_SITES` list to cut off a host quickly.
4. Explicit consent on screen: what is stored (token, task names and deadlines, Telegram chat, time zone), why, and how to turn it off.
5. `/stop` in the bot and a button on the site delete the token and everything else immediately. Hint on how to reset the token inside Moodle (verify the exact names in the Moodle UI).
6. An invalid or expired token pauses reminders, the bot asks to log in on the site again, and the token is deleted.
7. The Telegram webhook verifies a secret header. Site endpoints: CORS only for the site origin, size and rate limits.
8. The browser sync key is stored on the server only as a SHA-256 hash.

## Flow
1. Site: the "Reminders in Telegram" button → consent → `POST /api/link/start` (the site sends the token, the Moodle address and the time zone) → the server stores it encrypted and issues a one-time code → the site opens `t.me/<bot>?start=<code>`.
2. Bot: `/start <code>` binds the chat id and replies "Done, I will remind you".
3. Cron (every minute): (a) send reminders for tasks already known; (b) separately and less often, refresh tasks from Moodle for a few users per tick.
4. On every visit the site pushes fresh statuses (submitted / done) to the server when a binding is active.

## Reminder rules (defaults, confirmed)
- 24 h and 3 h before the deadline. Only: unsubmitted, not ticked as done, not overdue.
- Quiet hours 23:00–08:00 in the student's time zone: night reminders move to 08:00 if the deadline is later; if the deadline is before 08:00 the reminder goes out shortly before quiet hours start.
- Discovered late (2 h left): only the closest reminder is sent.
- Buttons: "Already done" (mutes reminders for that task), "Remind later".
- Task data is deleted 7 days after the deadline. Users who have not visited the site for 60 days are deleted; the bot warns them 7 days before (once per stretch of inactivity) and notifies them when it happens. Bot button presses do not count as a visit.

## Load on Moodle
- Submission statuses cost one request per assignment. So server-side refresh: a full collection every few hours (start with 3), statuses only for tasks due within 7 days, users spread over time, one user per tick.
- A clear User-Agent. Be gentle to the university's Moodle.
- The Worker subrequest limit (small on the free plan; check the exact value before starting) requires batched processing.

## Technical findings
- `src/lib/text.ts` uses `DOMParser`, which does not exist in a Worker. The Worker needs its own safe text-cleaning function; `collectSnapshot` cannot be reused as is.
- The site CSP already allows `connect-src https:`, so the Worker address needs no change in `_headers`.
- The repository root already has a Worker for the site (`moodle-dedlainy`). The reminders Worker is separate, with its own `worker/wrangler.jsonc`.

## Stages with verification
1. Skeleton, D1 schema, token encryption, a pure "what to send now" function + tests. **Done.**
2. Bot: webhook, `/start`, `/stop`, `/status`, `/help`. **Done** and deployed.
3. Linking and sync: endpoints, validation, limits, site dialog. **Done**, verified end to end locally (`wrangler dev` + local D1): link, simulated Start through the real webhook, task sync, done flag sync, logout cleanup.
4. Server-side refresh from Moodle + cron delivery + buttons. **Done**: cron every minute delivers due reminders (with Done / Later buttons), refreshes one user per tick every 3 h (backoff on failures, expired tokens pause the user and notify once), and cleans up every 10 minutes. Also a scheduled cleanup: expired unfinished link attempts (they hold an encrypted token until purged), tasks 7 days past their deadline, users inactive for 60 days.
5. Site UI: states, consent, deletion. Privacy text.
6. Deploy, verify on a real account, verify data deletion.

## Owner actions
- Create the bot in @BotFather (done: `@moodle_deadlines_bot`) and set the avatar (`docs/bot/avatar.png`).
- `npx wrangler login` (done).
- Secrets (`TOKEN_KEY`, bot token, webhook secret) are set by the owner with `wrangler secret put`, never pasted into chat. The bot token that was pasted into a chat once must be revoked in @BotFather (`/revoke`) before deploy.
