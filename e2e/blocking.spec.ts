/**
 * End-to-end check against a real Chromium with the built extension loaded unpacked.
 * Run `npm run build` first, then `npm run test:e2e`.
 *
 * Hermetic: `*.test` hostnames resolve to a local HTTP server, so no external network is used.
 */
import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');
const SHOTS = path.resolve('e2e/artifacts');

let context: BrowserContext;
let extensionId: string;
let server: Server;
let port: number;

/** e.g. site('distracting.test') → http://distracting.test:<port>/ */
const site = (host: string, pathname = '/') => `http://${host}:${port}${pathname}`;

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><title>${req.headers.host}</title><h1>Hello from ${req.headers.host?.split(':')[0]}</h1>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;

  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    colorScheme: 'dark',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--host-resolver-rules=MAP *.test 127.0.0.1, MAP *.instagram.com 127.0.0.1, MAP *.reddit.com 127.0.0.1',
    ],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
  server?.close();
});

async function openPopup(): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 380, height: 640 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.getByText('FocusGuard', { exact: true })).toBeVisible();
  return page;
}

/** Navigate a fresh tab (so a late error-page commit can't race the next navigation). */
async function expectBlocked(url: string) {
  const page = await context.newPage();
  const error = await page.goto(url).then(() => null, (e: Error) => e);
  expect(error?.message ?? 'navigation succeeded').toContain('ERR_BLOCKED_BY_CLIENT');
  await page.close();
}

async function expectAllowed(url: string, host: string) {
  const page = await context.newPage();
  await page.goto(url);
  await expect(page.locator('h1')).toHaveText(`Hello from ${host}`);
  await page.close();
}

// Keep tests independent: end any session a failed test may have left running.
test.afterEach(async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  // Runs inside the extension page, where the `chrome` global exists.
  await page.evaluate(() =>
    (globalThis as unknown as { chrome: { runtime: { sendMessage(m: unknown): Promise<unknown> } } }).chrome.runtime.sendMessage({
      type: 'END_SESSION',
      emergencyOverride: true,
    }),
  );
  await page.close();
});

test('blocks sites during focus, handles open tabs, and unblocks afterwards', async () => {
  // 1. Add a custom domain from the settings page.
  const options = await context.newPage();
  await options.setViewportSize({ width: 1280, height: 900 });
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel('Website to block').fill('https://www.distracting.test/some/path');
  await expect(options.getByText('Blocks distracting.test and all of its subdomains')).toBeVisible();
  await options.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(options.getByText('distracting.test', { exact: true })).toBeVisible();
  await options.screenshot({ path: `${SHOTS}/options.png`, fullPage: true });

  // 2. A distracting tab that is already open before focus starts.
  const openTab = await context.newPage();
  await openTab.goto(site('www.distracting.test', '/feed'));
  await expect(openTab.locator('h1')).toHaveText('Hello from www.distracting.test');

  // 3. Start an indefinite session from the popup.
  const popup = await openPopup();
  await popup.screenshot({ path: `${SHOTS}/popup-idle.png` });
  await popup.getByRole('radio', { name: 'No time limit' }).click();
  await popup.getByRole('button', { name: 'Start Focusing' }).click();
  await expect(popup.getByText('Focus mode on')).toBeVisible();
  await popup.screenshot({ path: `${SHOTS}/popup-active.png` });

  // 4. The already-open tab was reloaded into the block.
  await expect
    .poll(async () => openTab.evaluate(() => document.body.innerText).catch(() => ''), { timeout: 10_000 })
    .toContain('ERR_BLOCKED_BY_CLIENT');

  // 5. New navigations are blocked, including subdomains of default sites.
  await expectBlocked(site('distracting.test'));
  await expectBlocked(site('deep.sub.distracting.test'));
  await expectBlocked('https://www.instagram.com/');
  await expectBlocked('https://old.reddit.com/');

  // 6. Unrelated and lookalike sites are unaffected.
  await expectAllowed(site('docs.test'), 'docs.test');
  await expectAllowed(site('notdistracting.test'), 'notdistracting.test');

  // 7. End the session; navigation works again.
  await popup.getByRole('button', { name: 'End session' }).click();
  await expect(popup.getByText('Ready to focus')).toBeVisible();
  await expectAllowed(site('distracting.test'), 'distracting.test');
});

test('going back to a distracting page during focus is blocked', async () => {
  const tab = await context.newPage();
  await tab.goto(site('www.distracting.test', '/before-focus'));
  await tab.goto(site('docs.test', '/reading'));

  const popup = await openPopup();
  await popup.getByRole('radio', { name: 'No time limit' }).click();
  await popup.getByRole('button', { name: 'Start Focusing' }).click();
  await expect(popup.getByText('Focus mode on')).toBeVisible();

  // Going back either refetches (stopped by the block rule) or restores from the back/forward
  // cache without a request (caught by the webNavigation guard, which reloads the tab).
  await tab.goBack().catch(() => undefined);
  await expect
    .poll(async () => tab.evaluate(() => document.body.innerText).catch(() => ''), { timeout: 10_000 })
    .toContain('ERR_BLOCKED_BY_CLIENT');

  await popup.getByRole('button', { name: 'End session' }).click();
  await expect(popup.getByText('Ready to focus')).toBeVisible();
});

test('strict timed session hides End and shows the countdown', async () => {
  const popup = await openPopup();
  await popup.getByRole('radio', { name: '25 minutes' }).click();
  await popup.getByRole('switch', { name: 'Strict Mode' }).click();
  await expect(popup.getByRole('switch', { name: 'Strict Mode' })).toHaveAttribute('aria-checked', 'true');
  await popup.getByRole('button', { name: 'Start Focusing' }).click();
  await expect(popup.getByText('Strict focus')).toBeVisible();
  await expect(popup.getByRole('timer')).toHaveText(/^2[45]:\d\d$/);
  await expect(popup.getByRole('button', { name: 'End session' })).toHaveCount(0);

  // Countdown survives closing and reopening the popup.
  await popup.close();
  const reopened = await openPopup();
  await expect(reopened.getByRole('timer')).toHaveText(/^2[45]:\d\d$/);
  await reopened.screenshot({ path: `${SHOTS}/popup-strict.png` });

  // Emergency override from settings.
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel(/to unlock the override/).fill('end my focus session');
  const hold = options.getByRole('button', { name: /Hold to end session/ });
  await hold.hover();
  await options.mouse.down();
  await options.waitForTimeout(5400);
  await options.mouse.up();
  await expect(reopened.getByText('Ready to focus')).toBeVisible({ timeout: 5000 });
});
