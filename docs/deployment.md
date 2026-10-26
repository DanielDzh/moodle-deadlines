# Deployment

Both parts run on Cloudflare and are published automatically when a change lands in `main`.

| Part | Folder | Workflow | Cloudflare Worker |
|---|---|---|---|
| Static site | repository root | `.github/workflows/deploy-site.yml` | `moodle-dedlainy` |
| Telegram reminders bot | `worker/` | `.github/workflows/deploy-bot.yml` | `moodle-deadlines-bot` (+ D1 database) |

Pull requests only run the checks in `ci.yml` (site tests and build, Worker typecheck and tests). Nothing is deployed from a branch.

## What each deploy does

- **Site** (any change outside `worker/`, `docs/` and `*.md`): tests, build, `wrangler deploy`.
- **Bot** (any change under `worker/`): typecheck, tests, apply pending D1 migrations (`worker/migrations/`), `wrangler deploy`.

Migrations run automatically, so a migration must be safe to run against the live database: add tables and columns, do not drop or rewrite data in the same release that stops using it.

## One-time setup

1. In Cloudflare create an API token (My Profile → API Tokens). Use the "Edit Cloudflare Workers" template and add permission to edit D1 so migrations can run; check the exact permission names in the dashboard.
2. In GitHub open Settings → Secrets and variables → Actions and add two repository secrets:
   - `CLOUDFLARE_API_TOKEN`: the token from step 1
   - `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account id (shown by `npx wrangler whoami`)
3. Never paste the token into a chat or commit it. The Worker's own secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TOKEN_KEY`) stay in Cloudflare and are set once with `worker/scripts/setup-secrets.sh`.

If the two secrets are missing, the deploy job fails at its first step with a clear message and nothing is published.

## Manual deploy

```bash
npm run deploy              # site
cd worker && npx wrangler deploy   # bot (apply migrations first: npx wrangler d1 migrations apply moodle-deadlines-bot --remote)
```
