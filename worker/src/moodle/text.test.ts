import { describe, expect, it } from 'vitest';
import { cleanText } from './text';

describe('cleanText', () => {
  it('strips tags, decodes common entities and collapses whitespace', () => {
    expect(cleanText('Lab &amp; <b>essay</b>\n\n  3')).toBe('Lab & essay 3');
    expect(cleanText('&lt;not a tag&gt; &quot;q&quot; it&#39;s&nbsp;ok')).toBe('<not a tag> "q" it\'s ok');
  });
  it('drops script and style content entirely', () => {
    expect(cleanText('A<script>alert(1)</script>B<style>x{}</style>C')).toBe('ABC');
  });
  it('caps the length and tolerates non-strings', () => {
    expect(cleanText('x'.repeat(500), 200)).toHaveLength(200);
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(42)).toBe('');
  });
});
