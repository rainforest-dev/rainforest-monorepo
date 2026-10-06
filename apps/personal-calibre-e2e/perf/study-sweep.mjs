import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3334';
const HEADED = Boolean(process.env.HEADED);
const OUT = resolve(import.meta.dirname, '..', 'test-output', 'perf');
const ONLY = process.env.SWEEP_ONLY?.split(',') ?? null;
const STEPS = 40;
const STEP_MS = 150;
const ROW_SETTLE_MS = 400;

const RENDERERS = [
  { name: 'three-tsl-webgpu', renderer: 'three-tsl', backend: 'webgpu' },
  { name: 'three-tsl-webgl2', renderer: 'three-tsl', backend: 'webgl2' },
  { name: 'css', renderer: 'css', backend: 'css' },
];

const PROFILES = [
  {
    name: 'desktop',
    width: 1440,
    height: Number(process.env.DESKTOP_HEIGHT ?? 900),
    dpr: 2,
    throttle: 1,
  },
  {
    name: 'phone',
    width: 390,
    height: 844,
    dpr: 3,
    mobile: true,
    throttle: 4,
  },
];

const CONSOLE_ALLOWLIST = [/THREE\.Clock/];

const round = (value, digits = 1) =>
  value === null || value === undefined ? null : +value.toFixed(digits);

const stats = (values) => {
  if (values.length === 0) return { median: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    median: round(at(0.5), 2),
    p95: round(at(0.95), 2),
    max: round(sorted[sorted.length - 1], 2),
  };
};

const launch = () =>
  chromium.launch({
    headless: !HEADED,
    args: [
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--enable-gpu',
      '--use-angle=metal',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
    ],
  });

async function open(browser, run, profile) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    isMobile: Boolean(profile.mobile),
    hasTouch: Boolean(profile.mobile),
  });
  const page = await context.newPage();
  if (run.backend === 'webgl2') {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'gpu', {
        get: () => undefined,
        configurable: true,
      });
    });
  }
  const logs = [];
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    const text = `${message.type()}: ${message.text()}`;
    if (!CONSOLE_ALLOWLIST.some((pattern) => pattern.test(text))) {
      logs.push(text);
    }
  });
  page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`));
  await page.goto(
    `${BASE}/?view=study&groupBy=series&__pageSize=250&debug=1&renderer=${run.renderer}`,
  );
  await page.locator('[data-study-ready]').waitFor({ timeout: 60_000 });
  if (run.renderer !== 'css') {
    await page.waitForFunction(
      () => window.__calibreStudy?.prewarmedAt != null,
      null,
      { timeout: 60_000 },
    );
  }
  await page.waitForTimeout(800);
  return { context, page, logs };
}

const probeInfo = (page) =>
  page.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const info = window.__calibreStudy?.info() ?? null;
            const canvas = document.querySelector('[data-study-canvas] canvas');
            done(
              info && {
                ...info,
                canvas: canvas
                  ? { width: canvas.clientWidth, height: canvas.clientHeight }
                  : null,
              },
            );
          }),
        ),
      ),
  );

const isFocusPulled = (page) =>
  page.evaluate(
    () =>
      Number(document.activeElement?.dataset.bookId) ===
      window.__calibreStudy?.pulledId,
  );

async function sweep(page, three) {
  await page.evaluate(() => {
    window.__sweep = { frames: [], long: 0, stop: false };
    if (window.__calibreStudy) window.__calibreStudy.renderMs.length = 0;
    new PerformanceObserver((list) => {
      window.__sweep.long += list.getEntries().length;
    }).observe({ type: 'longtask' });
    let last = performance.now();
    const tick = (time) => {
      window.__sweep.frames.push(time - last);
      last = time;
      if (!window.__sweep.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  let mismatches = 0;
  for (let step = 0; step < STEPS; step++) {
    await page.keyboard.press(step % 10 === 9 ? 'ArrowDown' : 'ArrowRight');
    await page.waitForTimeout(STEP_MS);
    if (three && !(await isFocusPulled(page))) mismatches++;
  }
  await page.waitForTimeout(400);
  const { frames, long, renders } = await page.evaluate(() => {
    window.__sweep.stop = true;
    return {
      frames: window.__sweep.frames.slice(1),
      long: window.__sweep.long,
      renders: [...(window.__calibreStudy?.renderMs ?? [])],
    };
  });
  const dropped = frames.reduce(
    (count, delta) => count + Math.max(0, Math.round(delta / (1000 / 60)) - 1),
    0,
  );
  return {
    rafDelta: stats(frames),
    renderCpuMs: stats(renders),
    dropped,
    longTasks: long,
    focusPulledMismatches: mismatches,
  };
}

async function walkEveryRow(page, rows) {
  await page.keyboard.press('Control+Home');
  await page.waitForTimeout(ROW_SETTLE_MS);
  for (let row = 1; row < rows; row++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(ROW_SETTLE_MS);
  }
  await page.waitForFunction(
    (count) => window.__calibreStudy?.info().atlasRows === count,
    rows,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1000);
}

function memory(info) {
  if (!info?.canvas) return null;
  const { width, height } = info.canvas;
  const targetPixels = width * height * info.dpr ** 2 * 4;
  const unaccounted =
    info.texturesSizeReported - info.atlasBytes - (info.coverCacheBytes ?? 0);
  return {
    canvas: { width, height, dpr: info.dpr },
    atlasPpu: info.atlasPpu,
    atlasFits: info.atlasFits,
    coverCacheMax: info.coverCacheMax ?? null,
    coversCached: info.coversCached,
    atlasBytes: info.atlasBytes,
    coverCacheBytes: info.coverCacheBytes ?? null,
    textureBytesEstimated: info.textureBytesEstimated,
    texturesSizeReported: info.texturesSizeReported,
    unaccountedBytes: unaccounted,
    targetBuffersMeasured: round(unaccounted / targetPixels, 3),
  };
}

async function measure(run, profile) {
  const browser = await launch();
  try {
    const { page, logs } = await open(browser, run, profile);
    const three = run.renderer !== 'css';
    const boot = await page.evaluate(() => {
      const probe = window.__calibreStudy;
      const root =
        document.querySelector('[data-study-canvas][data-backend]') ??
        document.querySelector('[data-study-ready]');
      return {
        canvasMountToFirstFrameMs:
          probe && probe.firstFrameAt !== null
            ? probe.firstFrameAt - probe.canvasMountAt
            : null,
        firstRenderCallMs: probe?.firstRenderMs ?? null,
        initMs: probe?.initMs ?? null,
        kitLoadMs: probe?.kitLoadMs ?? null,
        backend: root?.getAttribute('data-backend') ?? null,
      };
    });
    if (profile.throttle > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', {
        rate: profile.throttle,
      });
    }
    await page.locator('[role="option"][tabindex="0"]').first().focus();
    await page.waitForTimeout(500);
    const before = three ? await probeInfo(page) : null;
    const swept = await sweep(page, three);
    const after = three ? await probeInfo(page) : null;
    let walked = null;
    if (three && after) {
      await walkEveryRow(page, after.rows);
      walked = await probeInfo(page);
    }
    return {
      label: `${run.name} ${profile.name}`,
      boot: {
        canvasMountToFirstFrameMs: round(boot.canvasMountToFirstFrameMs),
        firstRenderCallMs: round(boot.firstRenderCallMs),
        initMs: round(boot.initMs),
        kitLoadMs: round(boot.kitLoadMs),
        backend: boot.backend,
      },
      ...swept,
      programsBefore: before?.programs ?? null,
      programsAfter: after?.programs ?? null,
      programsAfterWalk: walked?.programs ?? null,
      drawCalls: after?.drawCalls ?? null,
      rows: after?.rows ?? null,
      texturesSizeReported: after?.texturesSizeReported ?? null,
      memoryAfterSweep: memory(after),
      memoryAfterWalk: memory(walked),
      console: [...new Set(logs)],
    };
  } finally {
    await browser.close();
  }
}

mkdirSync(OUT, { recursive: true });
const results = [];
for (const run of RENDERERS) {
  for (const profile of PROFILES) {
    const label = `${run.name} ${profile.name}`;
    if (ONLY && !ONLY.some((part) => label.includes(part))) continue;
    const result = await measure(run, profile);
    results.push(result);
    console.log(JSON.stringify(result));
  }
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(
  join(OUT, `study-sweep-${stamp}.json`),
  JSON.stringify(results, null, 1),
);
