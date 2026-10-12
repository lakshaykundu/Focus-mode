import { isCleanYouTubeActive } from '@/lib/blockList';
import { sendFocusRequest } from '@/lib/messageClient';
import { STORAGE_KEYS, loadAll, type StoredData } from '@/lib/storage';
import { isExpired } from '@/lib/timer';
import { BRIDGE_REQUEST_EVENT, BRIDGE_VIDEO_EVENT, parseBridgeDetail, watchVideoId } from '@/lib/youtubeBridge';
import { categoryLabel } from '@/lib/youtubeCategories';
import { CLEAN_YOUTUBE_STYLE_ID, buildCleanYouTubeCss, shortsToWatchUrl } from '@/lib/youtubeCleaner';
import { decideVideo, type VideoMetadata } from '@/lib/youtubeFilter';
import { createVideoOverlay } from './overlay';

/**
 * Clean YouTube + video filter. Active only while a focus session runs with YouTube enabled under
 * the "Clean YouTube" policy. It reads FocusGuard's local settings and the current video's
 * public metadata (from the MAIN-world bridge); it never reads or sends page content.
 * YouTube Music (music.youtube.com) is deliberately not matched.
 */
export default defineContentScript({
  matches: ['*://www.youtube.com/*', '*://m.youtube.com/*'],
  runAt: 'document_start',
  async main(ctx) {
    const storage = {
      get: (keys: string[]) => browser.storage.local.get(keys),
      set: async () => undefined, // read-only here
    };

    let data: StoredData | null = null;
    let video: VideoMetadata | null = null;
    let blocked = false;

    const overlay = createVideoOverlay({
      onAllowVideo: () => allow({ type: 'ALLOW_VIDEO', videoId: video?.videoId ?? '' }),
      onAllowChannel: () =>
        allow({ type: 'ALLOW_CHANNEL', channelId: video?.channelId ?? '', name: video?.channelName ?? '' }),
    });

    async function allow(request: Parameters<typeof sendFocusRequest>[0]): Promise<string | null> {
      const response = await sendFocusRequest(request);
      if (!response.ok) return response.error;
      await refresh();
      if (!blocked) void mainVideo()?.play().catch(() => undefined);
      return null;
    }

    const mainVideo = () =>
      document.querySelector<HTMLVideoElement>('#movie_player video, video.html5-main-video');

    const cleanActive = () => data !== null && isCleanYouTubeActive(data.settings, data.state);

    function applyStyle() {
      const css = cleanActive() ? buildCleanYouTubeCss(data!.settings.cleanYouTube) : '';
      let style = document.getElementById(CLEAN_YOUTUBE_STYLE_ID) as HTMLStyleElement | null;
      if (!css) {
        style?.remove();
        return;
      }
      if (!style) {
        style = document.createElement('style');
        style.id = CLEAN_YOUTUBE_STYLE_ID;
        (document.head ?? document.documentElement).append(style);
      }
      if (style.textContent !== css) style.textContent = css;
    }

    function redirectShorts() {
      if (!cleanActive() || !data!.settings.cleanYouTube.hideShorts) return;
      const target = shortsToWatchUrl(location.href);
      if (target) location.replace(target);
    }

    /** Show or clear the overlay for the current video. */
    function evaluate() {
      const settings = data?.settings;
      const session = data?.state.activeSession ?? null;
      const current = watchVideoId(location.href);
      if (!settings || !cleanActive() || !settings.youtubeFilter.enabled || !video || video.videoId !== current) {
        blocked = false;
        overlay.hide();
        return;
      }
      const decision = decideVideo(video, settings.youtubeFilter, session);
      blocked = !decision.allowed;
      if (decision.allowed) {
        overlay.hide();
        return;
      }
      const strict = session !== null && session.strictMode && !isExpired(session, Date.now());
      overlay.show({
        reason: decision.reason,
        category: decision.category,
        channelName: video.channelName,
        allowedLabels: settings.youtubeFilter.allowedCategories.map(categoryLabel),
        canOverride: !strict,
        canAllowChannel: video.channelId !== null,
      });
      mainVideo()?.pause();
    }

    async function refresh() {
      data = await loadAll(storage);
      applyStyle();
      redirectShorts();
      evaluate();
    }

    // Metadata from the MAIN-world bridge.
    ctx.addEventListener(document, BRIDGE_VIDEO_EVENT as keyof DocumentEventMap, (event) => {
      const parsed = parseBridgeDetail((event as CustomEvent).detail);
      if (parsed === undefined) return;
      video = parsed;
      evaluate();
    });

    // YouTube is a single-page app: it fires `yt-navigate-finish` after client-side navigation.
    ctx.addEventListener(document, 'yt-navigate-finish' as keyof DocumentEventMap, () => {
      redirectShorts();
      evaluate(); // hides a stale overlay until the bridge reports the new video
    });

    // Keep a blocked video paused, whatever tries to start it (autoplay, keyboard, YouTube).
    ctx.addEventListener(
      document,
      'play',
      (event) => {
        if (!blocked || !(event.target instanceof HTMLVideoElement)) return;
        event.target.pause();
        evaluate(); // re-attach the overlay if YouTube rebuilt the player
      },
      { capture: true },
    );

    // Autoplay can't be switched off through the page safely, so when a video ends we cancel
    // the "Up next" countdown if YouTube shows one. `ended` doesn't bubble, so listen in capture.
    ctx.addEventListener(
      document,
      'ended',
      () => {
        if (!cleanActive() || !data!.settings.cleanYouTube.hideAutoplay) return;
        for (const delay of [100, 600, 1500]) {
          ctx.setTimeout(() => {
            document.querySelector<HTMLElement>('.ytp-autonav-endscreen-upnext-cancel-button')?.click();
          }, delay);
        }
      },
      { capture: true },
    );

    const onStorageChanged = (changes: Record<string, unknown>, area: string) => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.settings in changes || STORAGE_KEYS.state in changes) void refresh();
    };
    browser.storage.onChanged.addListener(onStorageChanged);

    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(onStorageChanged);
      document.getElementById(CLEAN_YOUTUBE_STYLE_ID)?.remove();
      overlay.hide();
    });

    await refresh();
    // Ask the bridge for the current video in case it published before this script was ready.
    document.dispatchEvent(new CustomEvent(BRIDGE_REQUEST_EVENT));
  },
});
