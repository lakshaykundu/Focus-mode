/**
 * Generates the Chrome Web Store images in store/images/ at the exact required sizes, by loading
 * the built extension into Chromium and capturing real UI (plus live YouTube pages).
 *
 *   npm run store:assets      (builds first; needs network for the YouTube shots)
 */
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const EXT = path.resolve('.output/chrome-mv3');
const OUT = path.resolve('store/images');
const COMEDY_VIDEO = 'irp_XBZz2R0'; // categorized "Comedy" on YouTube

const iconSvg = readFileSync('assets/icon.svg', 'utf8');
const interWoff2 = readFileSync(
  'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
).toString('base64');
const dataUrl = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;

const BASE_CSS = `
@font-face { font-family: Inter; src: url(data:font/woff2;base64,${interWoff2}) format('woff2'); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { font-family: Inter, sans-serif; color: #ededef; -webkit-font-smoothing: antialiased;
  background: radial-gradient(70% 60% at 75% 30%, rgb(16 185 129 / 0.16), transparent 70%), #0a0a0b; overflow: hidden; }
.brand { display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 20px; letter-spacing: -0.01em; }
.brand svg { width: 40px; height: 40px; }
h1 { font-size: 54px; line-height: 1.04; letter-spacing: -0.035em; font-weight: 650; margin-top: 28px; }
h1 em { font-style: normal; color: #34d399; }
p.sub { margin-top: 20px; font-size: 20px; line-height: 1.5; color: #a1a1aa; max-width: 470px; }
.shot { border-radius: 16px; border: 1px solid rgb(255 255 255 / 0.1);
  box-shadow: 0 40px 80px -20px rgb(0 0 0 / 0.8), 0 0 0 1px rgb(0 0 0 / 0.5); display: block; }
`;

async function send(context: BrowserContext, extensionId: string, message: object) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  const result = await page.evaluate(
    (m) => (globalThis as unknown as { chrome: { runtime: { sendMessage(m: unknown): Promise<unknown> } } }).chrome.runtime.sendMessage(m),
    message,
  );
  await page.close();
  return result;
}

async function capturePopup(context: BrowserContext, extensionId: string): Promise<Buffer> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 380, height: 600 });
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.getByText('FocusGuard', { exact: true }).waitFor();
  await page.waitForTimeout(800);
  const png = await page.locator('#root > div').screenshot({ animations: 'disabled' });
  await page.close();
  return png;
}

async function render(page: Page, html: string, width: number, height: number, file: string, transparent = false) {
  await page.setViewportSize({ width, height });
  const bodyStyle = `width:${width}px;height:${height}px${transparent ? ';background:transparent' : ''}`;
  await page.setContent(`<!doctype html><html><head><style>${BASE_CSS}</style></head><body style="${bodyStyle}">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, file), omitBackground: transparent, scale: 'css' });
  console.log('✓', file);
}

function framed(headline: string, sub: string, popup: Buffer) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;height:100%;padding:0 110px 0 104px">
    <div>
      <div class="brand">${iconSvg}FocusGuard</div>
      <h1>${headline}</h1>
      <p class="sub">${sub}</p>
    </div>
    <img class="shot" src="${dataUrl(popup)}" style="width:380px">
  </div>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    colorScheme: 'dark',
    deviceScaleFactor: 2,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const canvas = await context.newPage();

  // Popup states.
  await send(context, id, { type: 'UPDATE_SETTINGS', patch: { youtubePolicy: 'clean', defaultDuration: 45 } });
  const idle = await capturePopup(context, id);
  await send(context, id, { type: 'UPDATE_SETTINGS', patch: { strictMode: true } });
  await send(context, id, { type: 'START_SESSION', duration: 45 });
  await canvas.waitForTimeout(2500);
  const strict = await capturePopup(context, id);
  await send(context, id, { type: 'END_SESSION', emergencyOverride: true });
  await send(context, id, { type: 'UPDATE_SETTINGS', patch: { strictMode: false } });

  await render(
    canvas,
    framed('Block distractions<br><em>in one click.</em>', 'Social media, streaming and music sites stay blocked until your focus session ends, even with the popup closed.', idle),
    1280, 800, 'screenshot-1-blocking.png',
  );

  // Live YouTube during a Clean YouTube session.
  await send(context, id, { type: 'START_SESSION', duration: 'indefinite' });
  const yt = await context.newPage();
  await yt.setViewportSize({ width: 1280, height: 800 });
  await yt.goto('https://www.youtube.com/', { waitUntil: 'domcontentloaded' });
  await yt.waitForTimeout(5000);
  await yt.screenshot({ path: path.join(OUT, 'screenshot-2-youtube-home.png'), scale: 'css' });
  console.log('✓ screenshot-2-youtube-home.png');
  await yt.goto(`https://www.youtube.com/watch?v=${COMEDY_VIDEO}`, { waitUntil: 'domcontentloaded' });
  await yt.locator('focusguard-video-overlay').waitFor({ state: 'attached', timeout: 20_000 });
  // Keep the uploader's title, links and handles out of the store listing; show only the player.
  await yt.addStyleTag({ content: '#below, ytd-watch-metadata, #comments { visibility: hidden !important; }' });
  await yt.waitForTimeout(2500);
  await yt.screenshot({ path: path.join(OUT, 'screenshot-3-youtube-filter.png'), scale: 'css' });
  console.log('✓ screenshot-3-youtube-filter.png');
  await yt.close();
  await send(context, id, { type: 'END_SESSION' });

  await render(
    canvas,
    framed('Strict Mode<br><em>keeps you honest.</em>', 'No End button and no unblocking until the timer finishes, with an emergency override for real emergencies.', strict),
    1280, 800, 'screenshot-4-strict.png',
  );

  // Settings page, YouTube filter section.
  const options = await context.newPage();
  await options.setViewportSize({ width: 1280, height: 800 });
  await options.goto(`chrome-extension://${id}/options.html`);
  await options.getByText('Filter videos by category').waitFor();
  // Show the Clean YouTube options and the video filter together, slightly zoomed out to fit.
  await options.evaluate(() => {
    (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = '0.92';
  });
  await options.waitForTimeout(300);
  const offset = await options.evaluate(() => {
    const header = [...document.querySelectorAll('p')].find((p) => p.textContent?.startsWith('Clean YouTube options'));
    const card = header?.closest('.rounded-xl');
    if (!card) throw new Error('Clean YouTube options card not found');
    window.scrollTo(0, 0);
    // With CSS zoom, rects and scroll offsets are both in zoomed pixels.
    const y = card.getBoundingClientRect().top - 6;
    window.scrollTo(0, y);
    return Math.round(card.getBoundingClientRect().top);
  });
  if (offset < 0 || offset > 20) throw new Error(`Settings card landed at y=${offset}`);
  await options.waitForTimeout(500);
  await options.screenshot({ path: path.join(OUT, 'screenshot-5-settings.png'), scale: 'css' });
  console.log('✓ screenshot-5-settings.png');
  await options.close();

  // Promo tiles.
  await render(
    canvas,
    `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 40px;
      background: radial-gradient(80% 90% at 85% 15%, rgb(16 185 129 / 0.22), transparent 70%)">
      <div style="width:64px;height:64px">${iconSvg.replace('<svg ', '<svg style="width:64px;height:64px" ')}</div>
      <div style="margin-top:18px;font-size:34px;font-weight:650;letter-spacing:-0.03em">FocusGuard</div>
      <div style="margin-top:6px;font-size:16px;color:#a1a1aa">Focus mode &amp; YouTube study filter</div>
    </div>`,
    440, 280, 'promo-small-440x280.png',
  );
  await render(
    canvas,
    `<div style="height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 120px">
      <div>
        <div class="brand" style="font-size:24px">${iconSvg}FocusGuard</div>
        <h1 style="font-size:60px">Learn on YouTube.<br><em>Skip the rabbit holes.</em></h1>
      </div>
      <img class="shot" src="${dataUrl(idle)}" style="width:300px;margin-top:150px">
    </div>`,
    1400, 560, 'promo-marquee-1400x560.png',
  );

  // Store icon: 96×96 artwork centred in a transparent 128×128 canvas, per Google's guidelines.
  // Captured as an element on a normal-size page (tiny viewports render unreliably).
  await canvas.setViewportSize({ width: 400, height: 400 });
  await canvas.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">
      <div id="icon" style="width:128px;height:128px;display:grid;place-items:center">${iconSvg.replace('<svg ', '<svg style="width:96px;height:96px;display:block" ')}</div>
    </body></html>`,
  );
  await canvas.locator('#icon').screenshot({ path: path.join(OUT, 'icon-128.png'), omitBackground: true, scale: 'css' });
  console.log('✓ icon-128.png');

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
