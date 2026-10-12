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

export interface AllowedChannel {
  /** YouTube channel ID (`UC…`), stable even if the channel is renamed. */
  id: string;
  name: string;
}

/**
 * Category-based video filter for Clean YouTube. Decisions use the category the uploader chose
 * on YouTube; this is metadata lookup, not content analysis.
 */
export interface YouTubeFilterSettings {
  enabled: boolean;
  /** IDs from `lib/youtubeCategories.ts`. */
  allowedCategories: string[];
  /** What to do when a video's category can't be read or isn't a known category. */
  unknownPolicy: 'allow' | 'block';
  allowedChannels: AllowedChannel[];
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
  youtubeFilter: YouTubeFilterSettings;
  ui: UiPreferences;
}
