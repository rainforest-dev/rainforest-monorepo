import { gzipSync } from 'node:zlib';

import { expect, type Page, test } from '@playwright/test';

import { setPrefs } from './support/library';
import { canvasWrap } from './support/study';

test.skip(
  process.env['CALIBRE_BUDGETS'] !== '1',
  'the bundle check runs with CALIBRE_BUDGETS=1 against next start',
);

const BUNDLE_MARKERS = {
  three: 'isWebGLRenderer',
  webgpu: 'isWebGPURenderer',
  tsl: 'isTextureNode',
  glsl: 'calibre-pulled-book-glsl',
} as const;

type MarkerName = keyof typeof BUNDLE_MARKERS;

const MARKER_NAMES = Object.keys(BUNDLE_MARKERS) as MarkerName[];
const LAZY_TSL_GZIP_BUDGET = 450 * 1024;
const LAZY_GLSL_GZIP_BUDGET = 260 * 1024;

interface LoadedScript {
  url: string;
  markers: MarkerName[];
  gzipBytes: number;
}

async function loadScripts(
  page: Page,
  url: string,
  ready?: () => Promise<void>,
): Promise<LoadedScript[]> {
  const pending: Promise<LoadedScript | null>[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() !== 'script') return;
    pending.push(
      response
        .text()
        .then((body) => ({
          url: response.url(),
          markers: MARKER_NAMES.filter((name) =>
            body.includes(BUNDLE_MARKERS[name]),
          ),
          gzipBytes: gzipSync(body).length,
        }))
        .catch(() => null),
    );
  });
  await page.goto(url);
  await ready?.();
  await page.waitForLoadState('networkidle');
  return (await Promise.all(pending)).filter(
    (script): script is LoadedScript => script !== null,
  );
}

function withMarkers(scripts: LoadedScript[]): string[] {
  return scripts.filter((s) => s.markers.length > 0).map((s) => s.url);
}

function markersOf(scripts: LoadedScript[]): MarkerName[] {
  return [...new Set(scripts.flatMap((s) => s.markers))].sort();
}

function lazyScripts(scripts: LoadedScript[], html: string): LoadedScript[] {
  const loaded = withMarkers(scripts);
  expect(loaded.length).toBeGreaterThan(0);
  for (const script of loaded) {
    expect(html).not.toContain(new URL(script).pathname);
  }
  return scripts.filter((s) => !html.includes(new URL(s.url).pathname));
}

function lazyGzip(label: string, lazy: LoadedScript[]): number {
  const total = lazy.reduce((sum, s) => sum + s.gzipBytes, 0);
  console.log(
    `[budget] lazy Study JS (${label}) ${(total / 1024).toFixed(1)} KB gzip`,
  );
  for (const script of lazy) {
    console.log(
      `[chunk] ${label} ${new URL(script.url).pathname} ${(script.gzipBytes / 1024).toFixed(1)} KB [${script.markers.join(', ')}]`,
    );
  }
  return total;
}

test.describe('Study bundle', () => {
  for (const url of [
    '/',
    '/books/1',
    '/read/1',
    '/?view=study&groupBy=series&renderer=css',
  ]) {
    test(`${url} loads nothing from three.js or a study kit`, async ({
      page,
    }) => {
      const scripts = await loadScripts(page, url);
      expect(scripts.length).toBeGreaterThan(0);
      expect(withMarkers(scripts)).toEqual([]);
    });
  }

  test('/ with Study and css in the cookie loads nothing from three.js', async ({
    page,
    context,
  }) => {
    await setPrefs(context, { view: 'study', renderer: 'css' });
    const scripts = await loadScripts(page, '/?groupBy=series', () =>
      expect(page.locator('[data-study-ready]')).toHaveAttribute(
        'data-renderer',
        'css',
      ),
    );
    expect(withMarkers(scripts)).toEqual([]);
  });

  test('the default three-tsl study loads the TSL kit and never the GLSL kit', async ({
    page,
    request,
  }) => {
    const url = '/?view=study&groupBy=series';
    const html = await (await request.get(url)).text();
    const scripts = await loadScripts(page, url, async () => {
      await expect(canvasWrap(page)).toHaveAttribute(
        'data-renderer',
        'three-tsl',
      );
      await expect(canvasWrap(page)).toHaveAttribute('data-backend', /.+/);
    });

    expect(markersOf(scripts)).toEqual(['three', 'tsl', 'webgpu']);
    const lazy = lazyGzip('tsl', lazyScripts(scripts, html));
    expect(lazy).toBeLessThanOrEqual(LAZY_TSL_GZIP_BUDGET);
  });

  test('the three-glsl study loads the GLSL kit and never three/webgpu or TSL', async ({
    page,
    request,
  }) => {
    const url = '/?view=study&groupBy=series&renderer=three-glsl';
    const html = await (await request.get(url)).text();
    const scripts = await loadScripts(page, url, () =>
      expect(canvasWrap(page)).toHaveAttribute('data-backend', 'webgl2'),
    );
    await expect(canvasWrap(page)).toHaveAttribute(
      'data-renderer',
      'three-glsl',
    );

    expect(markersOf(scripts)).toEqual(['glsl', 'three']);
    const lazy = lazyGzip('glsl', lazyScripts(scripts, html));
    expect(lazy).toBeLessThanOrEqual(LAZY_GLSL_GZIP_BUDGET);
  });
});
