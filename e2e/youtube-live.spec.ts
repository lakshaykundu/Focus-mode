/**
 * Live check of the Clean YouTube video filter against the real youtube.com.
 * Opt-in because it depends on YouTube's site and network: `LIVE_YOUTUBE=1 npm run test:e2e`.
 */
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';

test.skip(!process.env.LIVE_YOUTUBE, 'Set LIVE_YOUTUBE=1 to run against live YouTube');

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');
const SHOTS = path.resolve('e2e/artifacts');
// Real videos and the categories YouTube reports for them (October 2026).
const EDUCATION_VIDEO = 'thsUZEzL8ts'; // "The Magic of React's Reconciliation", Education
const COMEDY_VIDEO = 'irp_XBZz2R0'; // "Best Modern Comedic Movie Scenes", Comedy

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--autoplay-policy=no-user-gesture-required'],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

async function send(message: object) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const result = await page.evaluate(
    (m) => (globalThis as unknown as { chrome: { runtime: { sendMessage(m: unknown): Promise<unknown> } } }).chrome.runtime.sendMessage(m),
    message,
  );
  await page.close();
  return result as { ok: boolean; error?: string };
}

const overlay = (page: Page) => page.locator('focusguard-video-overlay');
const paused = (page: Page) => page.evaluate(() => document.querySelector<HTMLVideoElement>('#movie_player video')?.paused ?? null);

test('filters YouTube videos by category during a Clean YouTube session', async () => {
  expect((await send({ type: 'UPDATE_SETTINGS', patch: { youtubePolicy: 'clean' } })).ok).toBe(true);
  expect((await send({ type: 'START_SESSION', duration: 'indefinite' })).ok).toBe(true);
  const yt = await context.newPage();

  // 1. Comedy is outside the default allowed categories: covered and paused.
  await yt.goto(`https://www.youtube.com/watch?v=${COMEDY_VIDEO}`, { waitUntil: 'domcontentloaded' });
  await expect(overlay(yt)).toBeAttached({ timeout: 15_000 });
  await expect(overlay(yt).getByText('YouTube lists this video as')).toBeVisible();
  await expect(overlay(yt).getByText('Comedy')).toBeVisible();
  await expect.poll(() => paused(yt), { timeout: 10_000 }).toBe(true);
  await yt.waitForTimeout(1000);
  await yt.screenshot({ path: `${SHOTS}/youtube-blocked.png` });

  // 2. Client-side navigation: search, then open a result. The overlay follows the new video.
  await yt.locator('input[name="search_query"]').fill('react reconciliation explained');
  await yt.keyboard.press('Enter');
  await yt.waitForURL(/\/results/);
  await expect(overlay(yt)).toHaveCount(0);
  await yt.locator('ytd-video-renderer a#thumbnail[href^="/watch"]').first().click();
  await yt.waitForURL(/\/watch/);
  await yt.waitForTimeout(3000);
  const category = await yt.evaluate(() => {
    const player = document.getElementById('movie_player') as unknown as { getPlayerResponse(): { microformat?: { playerMicroformatRenderer?: { category?: string } } } };
    return player.getPlayerResponse().microformat?.playerMicroformatRenderer?.category ?? null;
  });
  const shouldBlock = !['Education', 'Science & Technology', 'Howto & Style'].includes(category ?? '');
  console.log(`search result category: ${category} → ${shouldBlock ? 'blocked' : 'allowed'}`);
  await expect(overlay(yt)).toHaveCount(shouldBlock ? 1 : 0);

  // 3. A known Education video plays without an overlay.
  await yt.goto(`https://www.youtube.com/watch?v=${EDUCATION_VIDEO}`, { waitUntil: 'domcontentloaded' });
  await yt.waitForTimeout(3000);
  await expect(overlay(yt)).toHaveCount(0);

  // 4. Clicking "Allow this video" on the overlay (content script → background) lets it play.
  await yt.goto(`https://www.youtube.com/watch?v=${COMEDY_VIDEO}`, { waitUntil: 'domcontentloaded' });
  await expect(overlay(yt)).toBeAttached({ timeout: 15_000 });
  await overlay(yt).getByRole('button', { name: 'Allow this video' }).click();
  await expect(overlay(yt)).toHaveCount(0, { timeout: 5000 });
  await expect.poll(() => paused(yt), { timeout: 10_000 }).toBe(false);

  // 5. Strict Mode: the overlay offers no way out.
  await send({ type: 'END_SESSION' });
  await send({ type: 'UPDATE_SETTINGS', patch: { strictMode: true } });
  expect((await send({ type: 'START_SESSION', duration: 25 })).ok).toBe(true);
  await yt.reload({ waitUntil: 'domcontentloaded' });
  await expect(overlay(yt)).toBeAttached({ timeout: 15_000 });
  await expect(overlay(yt).getByText('Strict Mode is on')).toBeVisible();
  await expect(overlay(yt).getByRole('button')).toHaveCount(0);

  await send({ type: 'END_SESSION', emergencyOverride: true });
  await send({ type: 'UPDATE_SETTINGS', patch: { strictMode: false } });
});
