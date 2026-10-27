import { describe, expect, it } from 'vitest';
import { classifyTelegramError } from './telegram-api';

describe('classifyTelegramError', () => {
  it('treats 403 and a missing chat as blocked', () => {
    expect(classifyTelegramError(403, { description: 'Forbidden: bot was blocked by the user' })).toEqual({ ok: false, reason: 'blocked' });
    expect(classifyTelegramError(400, { description: 'Bad Request: chat not found' })).toEqual({ ok: false, reason: 'blocked' });
    expect(classifyTelegramError(400, { description: 'Forbidden: user is deactivated' })).toEqual({ ok: false, reason: 'blocked' });
  });
  it('passes the retry delay of a rate limit', () => {
    expect(classifyTelegramError(429, { parameters: { retry_after: 7 } })).toEqual({ ok: false, reason: 'rate_limited', retryAfter: 7 });
  });
  it('treats everything else as a plain error to retry', () => {
    expect(classifyTelegramError(500, {})).toEqual({ ok: false, reason: 'error' });
    expect(classifyTelegramError(400, { description: 'Bad Request: message is too long' })).toEqual({ ok: false, reason: 'error' });
  });
});
