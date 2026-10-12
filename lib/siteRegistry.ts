import type { BlockedSite, SiteCategory } from '@/types/settings';

export interface CategoryMeta {
  id: SiteCategory;
  label: string;
  description: string;
}

export const CATEGORY_META: Record<SiteCategory, CategoryMeta> = {
  social: { id: 'social', label: 'Social Media', description: 'Feeds, stories and timelines' },
  entertainment: {
    id: 'entertainment',
    label: 'Entertainment',
    description: 'Video and streaming services',
  },
  music: { id: 'music', label: 'Music', description: 'Music streaming and discovery' },
  custom: { id: 'custom', label: 'Custom', description: 'Sites you added yourself' },
};

/** Categories with built-in sites, in display order. */
export const BUILT_IN_CATEGORIES = ['social', 'entertainment', 'music'] as const;

export const YOUTUBE_DOMAIN = 'youtube.com';

export const DEFAULT_SITES_BY_CATEGORY: Record<
  (typeof BUILT_IN_CATEGORIES)[number],
  readonly string[]
> = {
  social: ['instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'reddit.com'],
  music: ['spotify.com', 'music.youtube.com', 'soundcloud.com', 'music.apple.com', 'jiosaavn.com'],
  entertainment: [YOUTUBE_DOMAIN, 'netflix.com', 'twitch.tv', 'primevideo.com', 'hotstar.com'],
};

export function siteId(domain: string, custom: boolean): string {
  return `${custom ? 'custom' : 'default'}:${domain}`;
}

export function createDefaultSites(): BlockedSite[] {
  return BUILT_IN_CATEGORIES.flatMap((category) =>
    DEFAULT_SITES_BY_CATEGORY[category].map((domain) => ({
      id: siteId(domain, false),
      domain,
      category,
      enabled: true,
      custom: false,
    })),
  );
}
