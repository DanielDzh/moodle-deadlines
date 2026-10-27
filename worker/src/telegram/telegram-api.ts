import { DELIVERY, TELEGRAM_API_BASE } from '../config';

export interface InlineButton {
  text: string;
  data: string;
}

export type SendResult =
  | { ok: true }
  /** blocked: the user stopped the bot or the chat is gone; rate_limited: try later; error: anything else. */
  | { ok: false; reason: 'blocked' | 'rate_limited' | 'error'; retryAfter?: number };

export interface TelegramClient {
  sendMessage: (chatId: number, text: string, buttons?: readonly InlineButton[]) => Promise<SendResult>;
}

interface TelegramErrorBody {
  description?: string;
  parameters?: { retry_after?: number };
}

/** Maps a failed Bot API response to what the caller should do. Pure, so it is easy to test. */
export const classifyTelegramError = (status: number, body: TelegramErrorBody): SendResult => {
  const text = (body.description ?? '').toLowerCase();
  if (status === 429) return { ok: false, reason: 'rate_limited', retryAfter: body.parameters?.retry_after };
  if (status === 403) return { ok: false, reason: 'blocked' };
  if (status === 400 && (text.includes('chat not found') || text.includes('user is deactivated'))) return { ok: false, reason: 'blocked' };
  return { ok: false, reason: 'error' };
};

/** A small Bot API client for sending messages from cron. Never logs the token or message text. */
export const createTelegramClient = (token: string, apiBase: string = TELEGRAM_API_BASE): TelegramClient => ({
  sendMessage: async (chatId, text, buttons = []) => {
    try {
      const response = await fetch(`${apiBase}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          link_preview_options: { is_disabled: true },
          ...(buttons.length ? { reply_markup: { inline_keyboard: [buttons.map((b) => ({ text: b.text, callback_data: b.data }))] } } : {}),
        }),
        signal: AbortSignal.timeout(DELIVERY.requestTimeoutMs),
      });
      if (response.ok) return { ok: true };
      return classifyTelegramError(response.status, (await response.json().catch(() => ({}))) as TelegramErrorBody);
    } catch {
      return { ok: false, reason: 'error' };
    }
  },
});
