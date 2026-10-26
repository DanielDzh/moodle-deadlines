import { describe, expect, it } from 'vitest';
import { checkSite, normSite, safeUrl } from './url';

describe('normSite', () => {
  it.each([
    ['online.ubts.org.ua', 'https://online.ubts.org.ua'],
    ['https://online.ubts.org.ua/my/courses.php', 'https://online.ubts.org.ua'],
    ['  https://moodle.uni.edu/  ', 'https://moodle.uni.edu'],
    ['https://uni.edu/moodle/login/index.php?x=1', 'https://uni.edu/moodle'],
    ['https://uni.edu/moodle/course/view.php?id=5', 'https://uni.edu/moodle'],
    ['https://uni.edu/moodle/', 'https://uni.edu/moodle'],
    ['http://localhost:8787/', 'http://localhost:8787'],
    ['', ''],
  ])('%s → %s', (input, out) => {
    expect(normSite(input)).toBe(out);
  });
});

describe('safeUrl', () => {
  const base = 'https://moodle.uni.edu';

  it('lets http(s) through', () => {
    expect(safeUrl('https://moodle.uni.edu/mod/assign/view.php?id=1', base)).toBe(
      'https://moodle.uni.edu/mod/assign/view.php?id=1',
    );
    expect(safeUrl('/mod/forum/view.php?id=2', base)).toBe('https://moodle.uni.edu/mod/forum/view.php?id=2');
  });

  it('does not let javascript: and data: through', () => {
    expect(safeUrl('javascript:alert(1)', base)).toBe(base);
    expect(safeUrl('data:text/html,<b>x</b>', base)).toBe(base);
  });
});

describe('checkSite', () => {
  it('requires an address and https', () => {
    expect(checkSite('')).toMatch(/Вкажіть адресу/);
    expect(checkSite('http://moodle.uni.edu')).toMatch(/https/);
    expect(checkSite('https://moodle.uni.edu')).toBeNull();
    expect(checkSite('http://localhost:8787')).toBeNull();
  });
});
