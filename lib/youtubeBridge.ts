import { isChannelId, isVideoId, type VideoMetadata } from './youtubeFilter';

/** DOM events between the MAIN-world bridge and the isolated content script. */
export const BRIDGE_VIDEO_EVENT = 'focusguard:yt-video';
export const BRIDGE_REQUEST_EVENT = 'focusguard:yt-request';

/** `null` = not on a watch page. */
export type BridgeMessage = VideoMetadata | null;

const str = (value: unknown, max = 300): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

/**
 * Parse a bridge event's detail. The detail crosses JavaScript worlds as a JSON string and the
 * page can dispatch the same event, so it's treated as untrusted input and validated field by field.
 */
export function parseBridgeDetail(detail: unknown): BridgeMessage | undefined {
  if (typeof detail !== 'string') return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(detail);
  } catch {
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null) return undefined;
  const data = raw as Record<string, unknown>;
  if (data.videoId === null) return null;
  if (!isVideoId(data.videoId)) return undefined;
  return {
    videoId: data.videoId,
    category: str(data.category, 60),
    channelId: isChannelId(data.channelId) ? data.channelId : null,
    channelName: str(data.channelName, 100),
    title: str(data.title),
  };
}

/** The `v` parameter of a watch-page URL, or `null` for any other page. */
export function watchVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.pathname !== '/watch') return null;
    const id = parsed.searchParams.get('v');
    return isVideoId(id) ? id : null;
  } catch {
    return null;
  }
}
