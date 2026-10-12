import { describe, expect, it } from 'vitest';
import { DEFAULT_CLEAN_YOUTUBE } from '@/lib/storage';
import { buildCleanYouTubeCss, shortsToWatchUrl } from '@/lib/youtubeCleaner';

const allOff = { hideShorts: false, hideHomeFeed: false, hideSidebar: false, hideComments: false, hideAutoplay: false };

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
