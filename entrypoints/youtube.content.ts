import { isCleanYouTubeActive } from '@/lib/blockList';
import { STORAGE_KEYS, loadAll } from '@/lib/storage';
import { CLEAN_YOUTUBE_STYLE_ID, buildCleanYouTubeCss, shortsToWatchUrl } from '@/lib/youtubeCleaner';
import type { CleanYouTubeOptions } from '@/types/settings';

/**
 * Clean YouTube. Active only while a focus session runs with YouTube enabled under the
 * "Clean YouTube" policy. It reads local settings only and never reads or sends page content.
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

    let options: CleanYouTubeOptions | null = null; // null = inactive

    function applyStyle(css: string | null) {
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
      if (!options?.hideShorts) return;
      const target = shortsToWatchUrl(location.href);
      if (target) location.replace(target);
    }

    async function refresh() {
      const { settings, state } = await loadAll(storage);
      options = isCleanYouTubeActive(settings, state) ? settings.cleanYouTube : null;
      applyStyle(options ? buildCleanYouTubeCss(options) : null);
      redirectShorts();
    }

    const onStorageChanged = (changes: Record<string, unknown>, area: string) => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.settings in changes || STORAGE_KEYS.state in changes) void refresh();
    };
    browser.storage.onChanged.addListener(onStorageChanged);

    // YouTube is a single-page app: it fires `yt-navigate-finish` after client-side navigation.
    ctx.addEventListener(window, 'yt-navigate-finish' as keyof WindowEventMap, redirectShorts);

    // Autoplay can't be switched off through the page safely, so when a video ends we cancel
    // the "Up next" countdown if YouTube shows one. `ended` doesn't bubble, so listen in capture.
    ctx.addEventListener(
      document,
      'ended',
      () => {
        if (!options?.hideAutoplay) return;
        for (const delay of [100, 600, 1500]) {
          ctx.setTimeout(() => {
            document
              .querySelector<HTMLElement>('.ytp-autonav-endscreen-upnext-cancel-button')
              ?.click();
          }, delay);
        }
      },
      { capture: true },
    );

    ctx.onInvalidated(() => {
      browser.storage.onChanged.removeListener(onStorageChanged);
      applyStyle(null);
    });

    await refresh();
  },
});
