const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };

/**
 * Moodle names are HTML ("Lab &amp; <b>essay</b>"). A Worker has no DOMParser, so strip tags and decode the common entities.
 * The result goes into a plain-text Telegram message, so nothing here can run as markup.
 */
export const cleanText = (html: unknown, max = 200): string => {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
};
