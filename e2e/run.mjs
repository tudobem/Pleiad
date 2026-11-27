/**
 * `npm run e2e`: offline, update and startup checks in a real browser
 * (SPEC 18). Local only: uses an installed Playwright (`npm i -g playwright`
 * or a machine that has it) and is not part of CI. See e2e/README.md.
 */
import { execSync } from 'node:child_process';
import { cpSync, createReadStream, appendFileSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'e2e: Playwright is not installed. Install it with: npm i -g playwright && npx playwright install chromium',
  );
  process.exit(2);
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = '/pleiad/';
const PORT = 4179;
const URL_BASE = `http://localhost:${PORT}${BASE}`;
const STARTUP_BUDGET_MS = 1000;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

/** Static server for a build under /pleiad/; `root` can be switched (update test). */
function serve(initialRoot) {
  let root = initialRoot;
  const server = http.createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith(BASE)) return res.writeHead(404).end();
    path = path.slice(BASE.length) || 'index.html';
    let file = join(root, path);
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
    } catch {
      return res.writeHead(404).end();
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(PORT, () => resolve({ setRoot: (r) => (root = r), close: () => server.close() })),
  );
}

let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
  if (!ok) failures += 1;
};

/** Open the app and make sure the service worker controls the page. */
async function installed(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${URL_BASE}#/today`);
  await page.getByRole('button', { name: "Start today's session" }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: "Start today's session" }).waitFor();
  return { context, page, errors };
}

async function offline(browser) {
  const { context, page, errors } = await installed(browser);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: "Start today's session" }).waitFor();
  check(true, 'offline: cold start shows Today');
  await page.getByRole('button', { name: "Start today's session" }).click();
  await page.locator('.session__prompt').waitFor();
  check(true, 'offline: a session starts from cached packs');
  await page.evaluate(() => {
    location.hash = '#/library';
  });
  await page.locator('.subject-card').first().waitFor();
  check(true, 'offline: Library renders from the cached index');
  check(
    errors.length === 0,
    `offline: no page errors ${errors.length ? JSON.stringify(errors) : ''}`,
  );
  await context.close();
}

async function startup(browser) {
  const { context, page } = await installed(browser);
  await context.setOffline(true);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const times = [];
  for (let i = 0; i < 3; i += 1) {
    await page.reload();
    await page.getByRole('button', { name: "Start today's session" }).waitFor();
    times.push(await page.evaluate(() => Math.round(performance.now())));
  }
  const best = Math.min(...times);
  check(
    best < STARTUP_BUDGET_MS,
    `startup: first screen from cache at 4x CPU throttle in ${times.join(', ')} ms (budget ${STARTUP_BUDGET_MS} ms)`,
  );
  await context.close();
}

async function update(browser, server, nextDist) {
  const { context, page } = await installed(browser);
  check(
    (await page.getByText('An update is ready').count()) === 0,
    'update: no prompt without a new version',
  );
  server.setRoot(nextDist);
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  await page.getByText('An update is ready').waitFor({ timeout: 15000 });
  check(true, 'update: prompt shown on Today once a new version is waiting');
  await page.getByRole('button', { name: "Start today's session" }).click();
  await page.locator('.session__prompt').waitFor();
  check(
    (await page.getByText('An update is ready').count()) === 0,
    'update: never shown during a session',
  );
  await page.evaluate(() => {
    location.hash = '#/today';
  });
  await page.getByRole('button', { name: 'Restart now' }).waitFor();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Restart now' }).click(),
  ]);
  await page.waitForFunction(
    async () => !(await navigator.serviceWorker.getRegistration())?.waiting,
  );
  check(true, 'update: Restart now activates the new version');
  await context.close();
}

console.log('e2e: building with BASE_PATH=/pleiad/');
execSync('npm run build', { cwd: ROOT, stdio: 'ignore', env: { ...process.env, BASE_PATH: BASE } });
const dist = join(ROOT, 'dist');
const nextDist = join(ROOT, 'node_modules', '.tmp', 'e2e-next');
rmSync(nextDist, { recursive: true, force: true });
cpSync(dist, nextDist, { recursive: true });
// Any byte change to sw.js is a new version for the browser.
appendFileSync(join(nextDist, 'sw.js'), '\n// e2e: next version\n');

const server = await serve(dist);
const browser = await chromium.launch();
try {
  await offline(browser);
  await startup(browser);
  await update(browser, server, nextDist);
} finally {
  await browser.close();
  server.close();
  rmSync(nextDist, { recursive: true, force: true });
}
console.log(failures === 0 ? 'e2e: all checks passed' : `e2e: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
