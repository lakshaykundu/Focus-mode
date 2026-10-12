import type { FocusSession } from '@/types/focus';
import type { YouTubeFilterSettings } from '@/types/settings';
import { categoryIdFromName } from './youtubeCategories';

/** Public metadata the page's own player exposes for the current video. Nothing else is read. */
export interface VideoMetadata {
  videoId: string;
  /** Category name as YouTube reports it, e.g. "Education"; `null` if unavailable. */
  category: string | null;
  channelId: string | null;
  channelName: string | null;
  title: string | null;
}

export type VideoDecision =
  | { allowed: true; reason: 'category' | 'channel' | 'video' | 'unknown-allowed' }
  | { allowed: false; reason: 'category' | 'unknown'; category: string | null };

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{10,40}$/;

export const isVideoId = (value: unknown): value is string =>
  typeof value === 'string' && VIDEO_ID_RE.test(value);
export const isChannelId = (value: unknown): value is string =>
  typeof value === 'string' && CHANNEL_ID_RE.test(value);

/**
 * Decide whether a video may play during a session. Precedence: videos allowed for this session,
 * then always-allowed channels, then the video's YouTube category. When the category can't be
 * read, the user's `unknownPolicy` decides, and the overlay says so plainly.
 */
export function decideVideo(
  video: VideoMetadata,
  filter: YouTubeFilterSettings,
  session: Pick<FocusSession, 'allowedVideoIds'> | null,
): VideoDecision {
  if (session?.allowedVideoIds.includes(video.videoId)) return { allowed: true, reason: 'video' };
  if (video.channelId && filter.allowedChannels.some((c) => c.id === video.channelId)) {
    return { allowed: true, reason: 'channel' };
  }
  const id = categoryIdFromName(video.category);
  if (id === null) {
    return filter.unknownPolicy === 'allow'
      ? { allowed: true, reason: 'unknown-allowed' }
      : { allowed: false, reason: 'unknown', category: video.category };
  }
  return filter.allowedCategories.includes(id)
    ? { allowed: true, reason: 'category' }
    : { allowed: false, reason: 'category', category: video.category };
}

/** True when `after` would let through something `before` blocked (used by Strict Mode). */
export function isFilterLoosened(before: YouTubeFilterSettings, after: YouTubeFilterSettings): boolean {
  if (before.enabled && !after.enabled) return true;
  if (before.unknownPolicy === 'block' && after.unknownPolicy === 'allow') return true;
  if (after.allowedCategories.some((c) => !before.allowedCategories.includes(c))) return true;
  return after.allowedChannels.some((c) => !before.allowedChannels.some((b) => b.id === c.id));
}
