import { describe, expect, it } from 'vitest';
import { dedupeDomains, hostnameFromUrl, matchesDomain, normalizeDomain } from '@/lib/domainUtils';

const ok = (input: string) => {
  const result = normalizeDomain(input);
  if (!result.ok) throw new Error(`expected ${input} to normalize, got: ${result.error}`);
  return result.domain;
};

describe('normalizeDomain', () => {
  it.each([
    'instagram.com',
    'www.instagram.com',
    'https://instagram.com/',
    'https://www.instagram.com/explore/tags?x=1#top',
    'HTTP://WWW.INSTAGRAM.COM',
    '  instagram.com  ',
    'instagram.com.',
    'instagram.com:8080',
    'instagram.com/reels',
  ])('normalizes %j to instagram.com', (input) => {
    expect(ok(input)).toBe('instagram.com');
  });

  it('keeps meaningful subdomains', () => {
    expect(ok('https://music.youtube.com/watch?v=1')).toBe('music.youtube.com');
    expect(ok('m.facebook.com')).toBe('m.facebook.com');
  });

  it('converts internationalized domains to punycode', () => {
    expect(ok('bücher.de')).toBe('xn--bcher-kva.de');
  });

  it.each([
    ['', 'Enter a domain'],
    ['   ', 'Enter a domain'],
    ['localhost', 'top-level domain'],
    ['insta gram.com', 'spaces'],
    ['192.168.0.1', 'IP addresses'],
    ['[::1]', 'IP addresses'],
    ['ftp://example.com', 'http/https'],
    ['-bad-.com', 'valid domain'],
    ['example.123', 'valid domain'],
    ['exa_mple.com', 'valid domain'],
  ])('rejects %j', (input, message) => {
    const result = normalizeDomain(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe('matchesDomain', () => {
  it('matches the domain and its subdomains', () => {
    expect(matchesDomain('instagram.com', 'instagram.com')).toBe(true);
    expect(matchesDomain('www.instagram.com', 'instagram.com')).toBe(true);
    expect(matchesDomain('a.b.instagram.com', 'instagram.com')).toBe(true);
    expect(matchesDomain('WWW.Instagram.COM.', 'instagram.com')).toBe(true);
  });

  it('never matches lookalike or unrelated domains', () => {
    expect(matchesDomain('fakeinstagram.com', 'instagram.com')).toBe(false);
    expect(matchesDomain('instagram.com.evil.net', 'instagram.com')).toBe(false);
    expect(matchesDomain('instagram.co', 'instagram.com')).toBe(false);
    expect(matchesDomain('com', 'instagram.com')).toBe(false);
  });
});

describe('dedupeDomains', () => {
  it('removes duplicates after normalization, keeping first-seen order', () => {
    const inputs = ['https://www.instagram.com/', 'reddit.com', 'instagram.com', 'WWW.REDDIT.COM'];
    expect(dedupeDomains(inputs.map(ok))).toEqual(['instagram.com', 'reddit.com']);
  });
});

describe('hostnameFromUrl', () => {
  it('returns hosts only for web URLs', () => {
    expect(hostnameFromUrl('https://www.reddit.com/r/all')).toBe('www.reddit.com');
    expect(hostnameFromUrl('chrome://extensions')).toBeNull();
    expect(hostnameFromUrl('not a url')).toBeNull();
    expect(hostnameFromUrl(undefined)).toBeNull();
  });
});
