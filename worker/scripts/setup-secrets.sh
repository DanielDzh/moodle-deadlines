#!/usr/bin/env bash
# One-time setup after the first `npx wrangler deploy`:
#   - generates TOKEN_KEY and TELEGRAM_WEBHOOK_SECRET and stores them as Worker secrets,
#   - stores the Telegram bot token you type (hidden, never echoed or written to disk),
#   - points the Telegram webhook at the Worker.
#
# Usage: scripts/setup-secrets.sh https://moodle-deadlines-bot.<subdomain>.workers.dev
set -euo pipefail

WORKER_URL="${1:-}"
if [[ ! "$WORKER_URL" =~ ^https://[A-Za-z0-9.-]+$ ]]; then
  echo "Usage: $0 https://<worker-host>   (no trailing slash, no path)" >&2
  exit 1
fi

read -rsp "Telegram bot token (input is hidden): " BOT_TOKEN
echo
if [[ ! "$BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
  echo "That does not look like a Telegram bot token." >&2
  exit 1
fi

WEBHOOK_SECRET="$(openssl rand -hex 32)"

printf '%s' "$BOT_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' "$WEBHOOK_SECRET" | npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# Do not overwrite an existing encryption key: that would make stored Moodle tokens unreadable.
if npx wrangler secret list 2>/dev/null | grep -q '"TOKEN_KEY"'; then
  echo "TOKEN_KEY already exists, keeping it."
else
  openssl rand -base64 32 | tr -d '\n' | npx wrangler secret put TOKEN_KEY
fi

curl -fsS "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/telegram" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]' \
  --data-urlencode "drop_pending_updates=true"
echo
echo "Done. Send /start to the bot to check it."
