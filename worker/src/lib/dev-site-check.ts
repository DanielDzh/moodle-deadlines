import type { SiteCheck } from '../types';

/**
 * Accepts any Moodle address, so a mock Moodle on http://localhost works. Used only when the DEV_ALLOW_ANY_SITE
 * variable is "1", which is set in .dev.vars for local runs and never in production.
 */
export const devSiteCheck = (input: unknown): SiteCheck => ({ ok: true, site: String(input).replace(/\/+$/, '') });
