import type { Env } from './types';

/** Skeleton: the Telegram webhook, the site API and cron are added in the next stages. */
export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return new Response('ok');
    return new Response('Not found', { status: 404 });
  },

  async scheduled(_event: ScheduledController, _env: Env): Promise<void> {
    // Sending reminders and refreshing data from Moodle: stage 4.
  },
} satisfies ExportedHandler<Env>;
