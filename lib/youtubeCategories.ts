/**
 * YouTube's uploader-assignable video categories. The player reports the English name
 * (e.g. "Science & Technology") regardless of the viewer's language, so names map to stable IDs.
 */
export const YOUTUBE_CATEGORIES = [
  { id: 'education', label: 'Education' },
  { id: 'science', label: 'Science & Technology' },
  { id: 'howto', label: 'Howto & Style' },
  { id: 'news', label: 'News & Politics' },
  { id: 'nonprofits', label: 'Nonprofits & Activism' },
  { id: 'people', label: 'People & Blogs' },
  { id: 'music', label: 'Music' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'film', label: 'Film & Animation' },
  { id: 'sports', label: 'Sports' },
  { id: 'travel', label: 'Travel & Events' },
  { id: 'pets', label: 'Pets & Animals' },
  { id: 'autos', label: 'Autos & Vehicles' },
] as const;

export type YouTubeCategoryId = (typeof YOUTUBE_CATEGORIES)[number]['id'];

export const DEFAULT_ALLOWED_CATEGORIES: YouTubeCategoryId[] = ['education', 'science', 'howto'];

const BY_LABEL = new Map<string, YouTubeCategoryId>(
  YOUTUBE_CATEGORIES.map((c) => [c.label.toLowerCase(), c.id]),
);
const IDS = new Set<string>(YOUTUBE_CATEGORIES.map((c) => c.id));

export function isYouTubeCategoryId(value: unknown): value is YouTubeCategoryId {
  return typeof value === 'string' && IDS.has(value);
}

/** Map the player's category name to an ID; `null` if missing or not a known category. */
export function categoryIdFromName(name: string | null | undefined): YouTubeCategoryId | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase().replace(/\s+and\s+/g, ' & ');
  return BY_LABEL.get(normalized) ?? null;
}

export function categoryLabel(id: string): string {
  return YOUTUBE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
