// A browser smoke test (#87): build, serve dist/, drive the title screen, a match, the campaign and the
// Web of Ages in headless Chromium, and fail on any page error or console error. The lines that draw,
// play sound or read input run in no other test. Screenshots go to SMOKE_SHOTS (default test-results/smoke).
import { createServer, type Server } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { chromium, type Browser } from 'playwright-core';

const DIST = join(process.cwd(), 'dist');
const SHOTS = process.env.SMOKE_SHOTS ?? join(process.cwd(), 'test-results', 'smoke');
const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm',
};

let server: Server;
let browser: Browser;
let base = '';

beforeAll(async () => {
  execFileSync('npx', ['vite', 'build'], { stdio: 'ignore' });
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path.endsWith('/') ? path + 'index.html' : path);
    if (!existsSync(file)) file = join(DIST, 'index.html');
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const local = '/opt/pw-browsers/chromium';
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || (existsSync(local) ? local : undefined),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
}, 180_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

test('title, match, campaign and Web of Ages run without errors', async () => {
  mkdirSync(SHOTS, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

  await page.goto(`${base}?seed=7`);
  await page.waitForSelector('#title:not(.hidden)', { timeout: 60_000 });
  expect(await page.inputValue('#opt-seed')).toBe('7');
  await page.screenshot({ path: join(SHOTS, '1-title.png') });

  await page.click('[data-act="web-map"]');
  await page.waitForSelector('#campaign:not(.hidden)');
  await page.screenshot({ path: join(SHOTS, '2-web.png') });
  await page.click('[data-act="camp-back"]');
  await page.click('[data-act="campaign"]');
  await page.waitForSelector('#campaign:not(.hidden) [data-act="camp-open"]');
  await page.screenshot({ path: join(SHOTS, '3-campaign.png') });
  await page.click('[data-act="camp-back"]');

  await page.click('[data-act="start"]');
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 60_000 });
  await page.waitForTimeout(2000);
  await page.click('#workforce-btn');
  await page.waitForSelector('#workforce-panel:not(.hidden)');
  await page.screenshot({ path: join(SHOTS, '4-workers.png') });
  await page.click('#workforce-btn');
  await page.keyboard.press('.');
  await page.keyboard.press('Shift+.');
  await page.keyboard.press('Control+Shift+1');
  await page.keyboard.press('Shift+1');
  for (let i = 0; i < 4; i++) await page.keyboard.press('+');
  await page.waitForTimeout(20_000);
  await page.screenshot({ path: join(SHOTS, '5-match.png') });
  await page.keyboard.press('F10');
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, '6-menu.png') });
  await page.close();

  expect(errors).toEqual([]);
}, 240_000);
