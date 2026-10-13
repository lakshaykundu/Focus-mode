import { describe, expect, it } from 'vitest';
import { DEFAULT_CLEAN_YOUTUBE } from '@/lib/storage';
import { DOODLE_DATA_URI, HOME_HEADLINE, HOME_QUIPS, quipForDate } from '@/lib/homeDoodle';
import { buildCleanYouTubeCss, shortsToWatchUrl } from '@/lib/youtubeCleaner';

const allOff = { hideShorts: false, hideHomeFeed: false, hideSidebar: false, hideComments: false, hideAutoplay: false, hideGuide: false };

describe('buildCleanYouTubeCss', () => {
  it('emits nothing when every option is off', () => {
    expect(buildCleanYouTubeCss(allOff)).toBe('');
  });

  it('only includes enabled areas', () => {
    const css = buildCleanYouTubeCss({ ...allOff, hideComments: true });
    expect(css).toContain('ytd-comments#comments');
    expect(css).not.toContain('ytd-reel-shelf-renderer');
  });

  it('hides Shorts, feed and recommendations by default but never the player or search', () => {
    const css = buildCleanYouTubeCss(DEFAULT_CLEAN_YOUTUBE);
    expect(css).toContain('ytd-reel-shelf-renderer');
    expect(css).toContain('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');
    expect(css).toContain('ytd-watch-flexy #related');
    expect(css).not.toMatch(/#movie_player|ytd-searchbox|#search|ytd-playlist-panel-renderer/);
    // One rule per selector, so one unsupported selector can't disable the rest.
    for (const line of css.split('\n').filter((l) => l.includes('display: none'))) {
      expect(line.split('{')[0]).not.toContain(',');
    }
  });
});

describe('shortsToWatchUrl', () => {
  it('rewrites Shorts URLs to the regular player', () => {
    expect(shortsToWatchUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(shortsToWatchUrl('https://m.youtube.com/shorts/abc123DEF?feature=share')).toBe('https://m.youtube.com/watch?v=abc123DEF');
  });

  it('ignores other pages', () => {
    expect(shortsToWatchUrl('https://www.youtube.com/watch?v=abc')).toBeNull();
    expect(shortsToWatchUrl('https://www.youtube.com/@channel/shorts')).toBeNull();
    expect(shortsToWatchUrl('nonsense')).toBeNull();
  });
});

describe('home feed doodle', () => {
  const day = new Date(2026, 9, 13, 9);

  it('replaces the hidden feed with the doodle, headline and daily quip', () => {
    const css = buildCleanYouTubeCss(DEFAULT_CLEAN_YOUTUBE, day);
    expect(css).toContain('ytd-browse[page-subtype="home"]::before');
    expect(css).toContain(`url("${DOODLE_DATA_URI}")`);
    expect(css).toContain(HOME_HEADLINE.replace(/"/g, '\\"'));
    expect(css).toContain(quipForDate(day));
    expect(buildCleanYouTubeCss({ ...DEFAULT_CLEAN_YOUTUBE, hideHomeFeed: false }, day)).not.toContain('::before');
  });

  it('is a self-contained SVG data URI that cannot break out of the CSS url()', () => {
    expect(DOODLE_DATA_URI.startsWith('data:image/svg+xml,')).toBe(true);
    expect(DOODLE_DATA_URI).not.toMatch(/["'()\s]/);
    expect(decodeURIComponent(DOODLE_DATA_URI)).toContain('<svg');
    expect(decodeURIComponent(DOODLE_DATA_URI)).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  });

  it('rotates the quip once per local day and cycles through all of them', () => {
    expect(quipForDate(new Date(2026, 9, 13, 0, 5))).toBe(quipForDate(new Date(2026, 9, 13, 23, 55)));
    const week = Array.from({ length: HOME_QUIPS.length }, (_, i) => quipForDate(new Date(2026, 9, 13 + i)));
    expect(new Set(week).size).toBe(HOME_QUIPS.length);
    for (const quip of HOME_QUIPS) expect(quip).not.toMatch(/["\\]/);
  });
});

describe('simplified left menu', () => {
  it('hides every guide entry except Home, in the full and mini menus', () => {
    const css = buildCleanYouTubeCss({ ...allOff, hideGuide: true });
    expect(css).toContain('ytd-guide-entry-renderer:not(:has(a[href="/"]))');
    expect(css).toContain('ytd-mini-guide-entry-renderer:not(:has(a[href="/"]))');
    expect(css).toContain('ytd-guide-section-renderer:not(:has(a[href="/"]))');
    expect(buildCleanYouTubeCss(allOff)).toBe('');
  });

  it('is on by default for new and existing installs', async () => {
    const { sanitizeSettings } = await import('@/lib/storage');
    expect(DEFAULT_CLEAN_YOUTUBE.hideGuide).toBe(true);
    expect(sanitizeSettings({ cleanYouTube: { hideShorts: false } }).cleanYouTube.hideGuide).toBe(true);
  });
});
