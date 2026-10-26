/**
 * HTML from Moodle → plain text with line breaks.
 * Parsing happens in a separate DOMParser document where scripts do not run.
 */
export function toText(html: unknown): string {
  if (!html) return '';
  const prepared = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '$&\n');
  const doc = new DOMParser().parseFromString(prepared, 'text/html');
  doc.querySelectorAll('script, style, template').forEach((n) => n.remove());
  return (doc.body.textContent || '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Short description for a card: cut at a word boundary and add "…". */
export function shortText(text: string, max = 220): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return cut.slice(0, sp > max * 0.6 ? sp : max).replace(/[,.;:—–-]+$/, '') + '…';
}
