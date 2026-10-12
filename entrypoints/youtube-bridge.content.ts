import { BRIDGE_REQUEST_EVENT, BRIDGE_VIDEO_EVENT, watchVideoId } from '@/lib/youtubeBridge';

interface PlayerResponse {
  videoDetails?: { videoId?: string; channelId?: string; author?: string; title?: string };
  microformat?: { playerMicroformatRenderer?: { category?: string } };
}

/**
 * Runs in the page's own JavaScript world, the only place YouTube's player API is reachable. It
 * reads the current video's public metadata (ID, category, channel, title) and hands it to the
 * isolated FocusGuard content script. It reads nothing else and sends nothing off the page.
 */
export default defineContentScript({
  matches: ['*://www.youtube.com/*', '*://m.youtube.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    const GIVE_UP_MS = 6000;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const publish = (detail: object | null) => {
      document.dispatchEvent(new CustomEvent(BRIDGE_VIDEO_EVENT, { detail: JSON.stringify(detail ?? { videoId: null }) }));
    };

    const readPlayer = (): PlayerResponse | undefined => {
      const player = document.getElementById('movie_player') as { getPlayerResponse?: () => PlayerResponse } | null;
      try {
        return player?.getPlayerResponse?.();
      } catch {
        return undefined;
      }
    };

    // After client-side navigation the player briefly still describes the previous video, so
    // only publish once its video ID matches the URL.
    const scan = () => {
      clearTimeout(timer);
      const wanted = watchVideoId(location.href);
      if (!wanted) {
        publish(null);
        return;
      }
      const startedAt = Date.now();
      const attempt = () => {
        if (watchVideoId(location.href) !== wanted) return; // navigated away; a new scan follows
        const response = readPlayer();
        const details = response?.videoDetails;
        if (details?.videoId === wanted) {
          publish({
            videoId: wanted,
            category: response?.microformat?.playerMicroformatRenderer?.category ?? null,
            channelId: details.channelId ?? null,
            channelName: details.author ?? null,
            title: details.title ?? null,
          });
        } else if (Date.now() - startedAt > GIVE_UP_MS) {
          publish({ videoId: wanted, category: null, channelId: null, channelName: null, title: null });
        } else {
          timer = setTimeout(attempt, 150);
        }
      };
      attempt();
    };

    document.addEventListener('yt-navigate-finish', scan);
    document.addEventListener(BRIDGE_REQUEST_EVENT, scan);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scan, { once: true });
    } else {
      scan();
    }
  },
});
