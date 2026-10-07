import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3334';
const OUT = resolve(
  process.env.PHOTO_OUT ??
    join(import.meta.dirname, '..', 'test-output', 'perf', 'photo'),
);
const MODE = process.env.PHOTO_MODE ?? 'converge';
const CONFIGS = (process.env.PHOTO_CONFIGS ?? 'full-512').split(',');
const REFERENCE = process.env.PHOTO_REFERENCE ?? 'full-512';
const SCHEMES = (process.env.PHOTO_SCHEMES ?? 'light').split(',');
const POSES = (process.env.PHOTO_POSES ?? 'shelf').split(',');
const VIEWPORT = { width: 1440, height: 900 };
const PAN_SETTLE_MS = 200;

const VARIANTS = {
  full: { denoise: false },
  half: { renderScale: 0.5, denoise: false },
  dn: { denoise: true },
  halfdn: { renderScale: 0.5, denoise: true },
};

function parseConfig(name) {
  const [variant, samples, budget] = name.split('-');
  const base = VARIANTS[variant];
  if (!base || !Number(samples)) throw new Error(`unknown config ${name}`);
  return {
    ...base,
    maxSamples: Number(samples),
    ...(budget ? { frameBudget: Number(budget) * 1000 } : {}),
  };
}

const round = (value, digits = 1) =>
  value === null || value === undefined ? null : +value.toFixed(digits);

const launch = () =>
  chromium.launch({
    channel: 'chromium',
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

async function open(browser, { renderer, scheme, pose, options }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.addInitScript((photoOptions) => {
    const set = () => {
      if (window.__calibreStudy) {
        window.__calibreStudy.photoOptions = photoOptions;
        return;
      }
      requestAnimationFrame(set);
    };
    requestAnimationFrame(set);
  }, options ?? null);
  await page.goto(
    `${BASE}/?view=study&groupBy=series&__pageSize=250&debug=1&renderer=${renderer}`,
  );
  await page.locator('[data-study-canvas][data-backend]').waitFor({
    timeout: 60_000,
  });
  await page.waitForFunction(
    () => window.__calibreStudy?.prewarmedAt != null,
    null,
    { timeout: 60_000 },
  );
  if (pose === 'pulled') {
    await page.locator('[role="option"][tabindex="0"]').first().focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
  }
  await page.waitForTimeout(1500);
  return { context, page };
}

async function settle(page) {
  await page.evaluate(() => {
    window.__calibreStudy.photo = null;
  });
  await page.waitForFunction(
    () => window.__calibreStudy?.photo?.state === 'done',
    null,
    { timeout: 1_800_000, polling: 100 },
  );
  return page.evaluate(() => {
    const probe = window.__calibreStudy;
    return {
      ...probe.photo,
      samplesAt: probe.photo.samplesAt.slice(-1),
      frameMs: [],
      textures: probe.info().texturesSizeReported,
    };
  });
}

async function afterTakeover(page) {
  await page.locator('[data-study-canvas]').hover();
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(PAN_SETTLE_MS);
  return page.evaluate(() => {
    const probe = window.__calibreStudy;
    return {
      state: probe.photo?.state ?? null,
      textures: probe.info().texturesSizeReported,
    };
  });
}

const shoot = (page) => page.locator('[data-study-canvas]').screenshot();

function compareImages(page, reference, candidate) {
  return page.evaluate(
    async ({ reference, candidate }) => {
      const decode = async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes]));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const a = await decode(reference);
      const b = await decode(candidate);
      let sum = 0;
      let count = 0;
      for (let i = 0; i < a.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const d = a[i + c] - b[i + c];
          sum += d * d;
          count++;
        }
      }
      return Math.sqrt(sum / count);
    },
    {
      reference: reference.toString('base64'),
      candidate: candidate.toString('base64'),
    },
  );
}

function regionsOf(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('[data-study-canvas]');
    const origin = wrap.getBoundingClientRect();
    const local = (rect) =>
      rect && {
        left: rect.left - origin.left,
        top: rect.top - origin.top,
        width: rect.width,
        height: rect.height,
      };
    const regions = window.__calibreStudy.regions();
    const swatch = new OffscreenCanvas(1, 1).getContext('2d');
    const srgb = (css) => {
      swatch.clearRect(0, 0, 1, 1);
      swatch.fillStyle = css;
      swatch.fillRect(0, 0, 1, 1);
      return [...swatch.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const labels = [...document.querySelectorAll('[data-shelf-label]')]
      .map((label) => {
        const count = label.lastElementChild;
        return {
          text: label.textContent,
          rect: local(label.getBoundingClientRect()),
          countRect: local(count.getBoundingClientRect()),
          color: srgb(getComputedStyle(count).color),
        };
      })
      .filter(
        ({ rect }) => rect.top >= 0 && rect.top + rect.height <= origin.height,
      );
    return {
      panel: local(regions.panel),
      boards: regions.boards.map(local),
      books: regions.books.map(local),
      labels,
      size: { width: origin.width, height: origin.height },
    };
  });
}

function compareRegions(page, regions, reference, candidate) {
  return page.evaluate(
    async ({ regions, reference, candidate }) => {
      const decode = async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes]));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return {
          data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data,
          width: bitmap.width,
          height: bitmap.height,
        };
      };
      const a = await decode(reference);
      const b = await decode(candidate);
      const scale = a.width / regions.size.width;
      const linear = (v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const lab = (r, g, bl) => {
        const [R, G, B] = [linear(r), linear(g), linear(bl)];
        const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
        const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
        const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
        const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
      };
      const luminance = (r, g, bl) =>
        0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(bl);
      const contrast = (l1, l2) =>
        (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const mask = new Uint8Array(a.width * a.height);
      const fill = (rect, value) => {
        if (!rect) return;
        const x0 = Math.max(0, Math.floor(rect.left * scale));
        const y0 = Math.max(0, Math.floor(rect.top * scale));
        const x1 = Math.min(
          a.width,
          Math.ceil((rect.left + rect.width) * scale),
        );
        const y1 = Math.min(
          a.height,
          Math.ceil((rect.top + rect.height) * scale),
        );
        for (let y = y0; y < y1; y++)
          mask.fill(value, y * a.width + x0, y * a.width + x1);
      };
      fill(regions.panel, 1);
      for (const rect of regions.books) fill(rect, 3);
      for (const rect of regions.boards) fill(rect, 2);
      for (const label of regions.labels) fill(label.rect, 0);
      const names = ['', 'panel', 'boards', 'spines'];
      const sums = names.map(() => ({
        n: 0,
        a: [0, 0, 0],
        b: [0, 0, 0],
        de: 0,
      }));
      for (let i = 0; i < mask.length; i++) {
        const m = mask[i];
        if (!m) continue;
        const p = i * 4;
        const s = sums[m];
        const la = lab(a.data[p], a.data[p + 1], a.data[p + 2]);
        const lb = lab(b.data[p], b.data[p + 1], b.data[p + 2]);
        s.n++;
        for (let c = 0; c < 3; c++) {
          s.a[c] += la[c];
          s.b[c] += lb[c];
        }
        s.de += Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
      }
      const result = {};
      for (let m = 1; m < names.length; m++) {
        const s = sums[m];
        if (!s.n) continue;
        const ma = s.a.map((v) => v / s.n);
        const mb = s.b.map((v) => v / s.n);
        result[names[m]] = {
          pixels: s.n,
          meanColourDeltaE: +Math.hypot(
            ma[0] - mb[0],
            ma[1] - mb[1],
            ma[2] - mb[2],
          ).toFixed(2),
          meanPixelDeltaE: +(s.de / s.n).toFixed(2),
          lightnessShift: +(mb[0] - ma[0]).toFixed(2),
        };
      }
      const median = (img, rect) => {
        const values = [];
        const x0 = Math.floor(rect.left * scale);
        const y0 = Math.floor(rect.top * scale);
        const x1 = Math.ceil((rect.left + rect.width) * scale);
        const y1 = Math.ceil((rect.top + rect.height) * scale);
        for (let y = Math.max(0, y0); y < Math.min(img.height, y1); y++) {
          for (let x = Math.max(0, x0); x < Math.min(img.width, x1); x++) {
            const p = (y * img.width + x) * 4;
            values.push(
              luminance(img.data[p], img.data[p + 1], img.data[p + 2]),
            );
          }
        }
        values.sort((l, r) => l - r);
        return values[Math.floor(values.length / 2)] ?? 0;
      };
      result.labels = regions.labels.map((label) => {
        const text = luminance(...label.color);
        return {
          label: label.text,
          reference: +contrast(text, median(a, label.countRect)).toFixed(2),
          candidate: +contrast(text, median(b, label.countRect)).toFixed(2),
        };
      });
      return result;
    },
    {
      regions,
      reference: reference.toString('base64'),
      candidate: candidate.toString('base64'),
    },
  );
}

async function converge(browser) {
  const results = [];
  let reference = null;
  const referencePath = join(OUT, `reference-${REFERENCE}.png`);
  try {
    reference = readFileSync(referencePath);
  } catch {
    reference = null;
  }
  const names = reference ? CONFIGS : [REFERENCE, ...CONFIGS];
  for (const name of names) {
    const options = parseConfig(name);
    const { context, page } = await open(browser, {
      renderer: 'three-pathtrace',
      scheme: 'light',
      pose: 'shelf',
      options,
    });
    const before = await page.evaluate(
      () => window.__calibreStudy.info().texturesSizeReported,
    );
    const done = await settle(page);
    const image = await shoot(page);
    writeFileSync(join(OUT, `converge-${name}.png`), image);
    if (name === REFERENCE && !reference) {
      reference = image;
      writeFileSync(referencePath, image);
    }
    const takeover = await afterTakeover(page);
    const result = {
      config: name,
      options,
      settledMs: round(done.settledAt),
      presentedMs: round(done.presentedAt),
      buildMs: round(done.buildMs),
      samples: round(done.samples, 1),
      rmse: round(await compareImages(page, reference, image), 2),
      texturesBefore: before,
      texturesWhileTracing: done.textures,
      memoryPeakBytes: done.memoryPeakBytes,
      texturesAfterTakeover: takeover.textures,
      stateAfterTakeover: takeover.state,
    };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
  return results;
}

async function compareFiles(browser) {
  const results = [];
  const dir = process.env.PHOTO_CANDIDATES;
  for (const scheme of SCHEMES) {
    for (const pose of POSES) {
      const flat = await open(browser, { renderer: 'three-tsl', scheme, pose });
      const reference = await shoot(flat.page);
      const regions = await regionsOf(flat.page);
      const candidate = readFileSync(
        join(dir, `three-pathtrace-${scheme}-${pose}.png`),
      );
      const result = {
        scheme,
        pose,
        ...(await compareRegions(flat.page, regions, reference, candidate)),
      };
      await flat.context.close();
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }
  return results;
}

async function look(browser) {
  const results = [];
  const config = CONFIGS[0];
  const options = parseConfig(config);
  for (const scheme of SCHEMES) {
    for (const pose of POSES) {
      const flat = await open(browser, {
        renderer: 'three-tsl',
        scheme,
        pose,
      });
      const reference = await shoot(flat.page);
      const regions = await regionsOf(flat.page);
      await flat.context.close();
      writeFileSync(
        join(OUT, `look-three-tsl-${scheme}-${pose}.png`),
        reference,
      );

      const traced = await open(browser, {
        renderer: 'three-pathtrace',
        scheme,
        pose,
        options,
      });
      const done = await settle(traced.page);
      const image = await shoot(traced.page);
      writeFileSync(
        join(OUT, `look-three-pathtrace-${config}-${scheme}-${pose}.png`),
        image,
      );
      const result = {
        config,
        scheme,
        pose,
        settledMs: round(done.settledAt),
        ...(await compareRegions(traced.page, regions, reference, image)),
      };
      await traced.context.close();
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }
  return results;
}

mkdirSync(OUT, { recursive: true });
const browser = await launch();
let results;
try {
  const modes = { look, compare: compareFiles, converge };
  results = await (modes[MODE] ?? converge)(browser);
} finally {
  await browser.close();
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(
  join(OUT, `study-photo-${MODE}-${stamp}.json`),
  JSON.stringify(results, null, 1),
);
