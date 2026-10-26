import { describe, expect, it } from 'vitest';
import { checkMoodleSite, parseBlockedSites } from './site-url';

describe('checkMoodleSite (SSRF guard)', () => {
  it.each([
    ['https://online.ubts.org.ua', 'https://online.ubts.org.ua'],
    ['https://Online.UBTS.org.ua/', 'https://online.ubts.org.ua'],
    ['https://uni.edu/moodle/', 'https://uni.edu/moodle'],
    ['https://uni.edu/moodle/my/courses.php?x=1#top', 'https://uni.edu/moodle/my/courses.php'],
    ['https://uni.edu:443', 'https://uni.edu'],
    ['https://xn--80ak6aa92e.com', 'https://xn--80ak6aa92e.com'],
  ])('accepts %s', (input, site) => {
    expect(checkMoodleSite(input)).toEqual({ ok: true, site });
  });

  it.each([
    'http://uni.edu',
    'ftp://uni.edu',
    'javascript:alert(1)',
    'https://localhost',
    'https://127.0.0.1',
    'https://10.0.0.5',
    'https://192.168.1.1',
    'https://169.254.169.254',
    'https://[::1]',
    'https://2130706433',
    'https://moodle',
    'https://moodle.local',
    'https://db.internal',
    'https://router.lan',
    'https://uni.edu:8443',
    'https://user:pass@uni.edu',
    'https://-bad-.uni.edu',
    'https://uni..edu',
    'not a url',
    '',
  ])('rejects %s', (input) => {
    expect(checkMoodleSite(input).ok).toBe(false);
  });

  it('reports why: https required and blocked hosts', () => {
    expect(checkMoodleSite('http://uni.edu')).toEqual({ ok: false, reason: 'https_required' });
    expect(checkMoodleSite('https://evil.example.com', ['example.com'])).toEqual({ ok: false, reason: 'blocked_site' });
    expect(checkMoodleSite('https://evil.example.com', ['other.org']).ok).toBe(true);
  });

  it('rejects non-strings and absurdly long input', () => {
    expect(checkMoodleSite(undefined).ok).toBe(false);
    expect(checkMoodleSite(42).ok).toBe(false);
    expect(checkMoodleSite(`https://${'a'.repeat(250)}.com`).ok).toBe(false);
  });

  it('parses the blocked list', () => {
    expect(parseBlockedSites(' A.com, b.org ,,')).toEqual(['a.com', 'b.org']);
    expect(parseBlockedSites(undefined)).toEqual([]);
  });
});
