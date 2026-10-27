const ALLOWED_HEADERS = 'Authorization, Content-Type';
const ALLOWED_METHODS = 'GET, POST, OPTIONS';

/** Parses the comma-separated ALLOWED_ORIGINS variable. */
export const parseOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/** CORS headers for an allowed origin, or null if the request comes from anywhere else. */
export const corsHeadersFor = (request: Request, allowed: readonly string[]): Record<string, string> | null => {
  const origin = request.headers.get('Origin');
  if (!origin || !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
};
