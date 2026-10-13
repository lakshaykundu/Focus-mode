import type { CleanYouTubeOptions } from '@/types/settings';
import { buildHomeDoodleCss } from './homeDoodle';

/**
 * Clean YouTube is pure CSS: a single stylesheet hides distracting areas, and because CSS
 * applies to elements as YouTube inserts them, no MutationObserver or DOM scanning is needed.
 *
 * YouTube changes its markup often, so each area lists several selectors (desktop `ytd-*`,
 * newer view-model elements, and mobile `ytm-*`). A selector that no longer matches is
 * harmless. Playback, search, playlists and the video description are never targeted.
 */
const SELECTORS = {
  hideShorts: [
    'ytd-reel-shelf-renderer',
    'ytd-rich-shelf-renderer[is-shorts]',
    'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
    'grid-shelf-view-model:has(ytm-shorts-lockup-view-model)',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
    'ytd-video-renderer:has(a[href^="/shorts/"])',
    'ytd-guide-entry-renderer:has(a[href^="/shorts"])',
    'ytd-guide-entry-renderer:has(a[title="Shorts"])',
    'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])',
    'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
    'yt-tab-shape[tab-title="Shorts"]',
    'ytm-reel-shelf-renderer',
    'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
  ],
  hideHomeFeed: [
    'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer',
    'ytd-browse[page-subtype="home"] #chips-wrapper',
    'ytd-browse[page-subtype="home"] ytd-feed-filter-chip-bar-renderer',
  ],
  hideSidebar: [
    'ytd-watch-flexy #related',
    'ytd-watch-next-secondary-results-renderer',
    '.ytp-endscreen-content',
    '.html5-endscreen',
    '.ytp-ce-element',
    'ytm-item-section-renderer[section-identifier="related-items"]',
  ],
  hideComments: [
    'ytd-comments#comments',
    'ytm-comment-section-renderer',
    'ytm-comments-entry-point-header-renderer',
  ],
  hideAutoplay: [
    '.ytp-autonav-toggle-button-container',
    '.ytp-autonav-endscreen-countdown-overlay',
    '.ytp-autonav-endscreen-upnext-container',
    'ytd-compact-autoplay-renderer',
  ],
  // Left menu: keep only the Home entry (it links to "/"). Covers the full menu, the collapsed
  // mini menu and the hamburger drawer, which all use these elements.
  hideGuide: [
    'ytd-guide-section-renderer:not(:has(a[href="/"]))',
    'ytd-guide-entry-renderer:not(:has(a[href="/"]))',
    'ytd-guide-collapsible-entry-renderer',
    'ytd-guide-collapsible-section-entry-renderer',
    'ytd-guide-signin-promo-renderer',
    'ytd-guide-renderer #footer',
    'ytd-mini-guide-entry-renderer:not(:has(a[href="/"]))',
  ],
} as const satisfies Record<keyof CleanYouTubeOptions, readonly string[]>;

export const CLEAN_YOUTUBE_STYLE_ID = 'focusguard-clean-youtube';

/**
 * CSS for the enabled options, or an empty string if every option is off. `date` picks the
 * day's quip on the home-feed doodle.
 */
export function buildCleanYouTubeCss(options: CleanYouTubeOptions, date = new Date()): string {
  const blocks: string[] = [];
  for (const key of Object.keys(SELECTORS) as Array<keyof CleanYouTubeOptions>) {
    if (!options[key]) continue;
    // One rule per selector: an unsupported selector would invalidate a combined selector list.
    for (const selector of SELECTORS[key]) {
      blocks.push(`${selector} { display: none !important; }`);
    }
  }
  if (options.hideHomeFeed) blocks.push(buildHomeDoodleCss(date));
  return blocks.join('\n');
}

/** `/shorts/<id>` → `/watch?v=<id>` so Shorts open in the regular player, without the feed. */
export function shortsToWatchUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,})/);
    if (!match) return null;
    return `${parsed.origin}/watch?v=${match[1]}`;
  } catch {
    return null;
  }
}
