export const SITE_CATEGORIES = ['social', 'entertainment', 'music', 'custom'] as const;
export type SiteCategory = (typeof SITE_CATEGORIES)[number];

export interface BlockedSite {
  /** Stable identifier: `default:<domain>` for registry sites, `custom:<domain>` for user sites. */
  id: string;
  /** Normalized registrable domain or subdomain, e.g. `instagram.com`, `music.youtube.com`. */
  domain: string;
  category: SiteCategory;
  enabled: boolean;
  custom: boolean;
}

export interface CategoryPreference {
  enabled: boolean;
}

/**
 * - `block`: youtube.com is treated as a distracting site and blocked outright.
 * - `clean`: youtube.com loads, but the content script hides Shorts, feeds and recommendations.
 */
export type YouTubePolicy = 'block' | 'clean';

export interface CleanYouTubeOptions {
  hideShorts: boolean;
  hideHomeFeed: boolean;
  hideSidebar: boolean;
  hideComments: boolean;
  hideAutoplay: boolean;
}

/** Minutes for a timed session, or `'indefinite'` for a session without an end time. */
export type SessionDuration = number | 'indefinite';

export interface UiPreferences {
  /** Last value typed into the custom-duration input. */
  lastCustomMinutes: number;
}

export interface FocusSettings {
  schemaVersion: 1;
  defaultDuration: SessionDuration;
  strictMode: boolean;
  categories: Record<SiteCategory, CategoryPreference>;
  sites: BlockedSite[];
  youtubePolicy: YouTubePolicy;
  cleanYouTube: CleanYouTubeOptions;
  ui: UiPreferences;
}
