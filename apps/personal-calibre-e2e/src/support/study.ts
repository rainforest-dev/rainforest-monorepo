import { expect, type Locator, type Page } from '@playwright/test';

export type StudyRun =
  { renderer: 'css' } | { renderer: 'three-tsl'; backend: 'webgpu' | 'webgl2' };

export const STUDY_RUNS: readonly StudyRun[] = [
  { renderer: 'three-tsl', backend: 'webgpu' },
  { renderer: 'three-tsl', backend: 'webgl2' },
  { renderer: 'css' },
];

const CONSOLE_ALLOWLIST: readonly RegExp[] = [
  /THREE\.Clock/,
  // Headless Chromium logs this for any composited WebGL canvas.
  /GL Driver Message .*GPU stall due to ReadPixels/,
];

export function runName(run: StudyRun): string {
  return run.renderer === 'css' ? 'css' : `${run.renderer}-${run.backend}`;
}

export async function prepareRun(page: Page, run: StudyRun): Promise<void> {
  if (run.renderer === 'three-tsl' && run.backend === 'webgl2') {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'gpu', {
        get: () => undefined,
        configurable: true,
      });
    });
  }
}

export async function gotoStudy(
  page: Page,
  run: StudyRun,
  query?: string,
): Promise<void> {
  const extra = query ? `&${query.replace(/^[?&]/, '')}` : '';
  await page.goto(
    `/?view=study&groupBy=series&renderer=${run.renderer}${extra}`,
  );
  await expect(page.locator('[data-library-ready]')).toHaveCount(1);
  await expect(page.locator('[data-study-ready]')).toHaveCount(1);
}

export function studyOptions(page: Page): Locator {
  return page.getByRole('listbox', { name: 'Bookshelves' }).getByRole('option');
}

export function shelves(page: Page): Locator {
  return page.getByRole('listbox', { name: 'Bookshelves' }).getByRole('group');
}

export function canvasWrap(page: Page): Locator {
  return page.locator('[data-study-canvas]');
}

export function collectConsole(page: Page): () => string[] {
  const messages: string[] = [];
  const record = (text: string) => {
    if (!CONSOLE_ALLOWLIST.some((pattern) => pattern.test(text))) {
      messages.push(text);
    }
  };
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      record(`${type}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => record(`pageerror: ${error.message}`));
  return () => [...messages];
}

export async function hasWebGpu(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter(): Promise<unknown> };
      }
    ).gpu;
    if (!gpu) return false;
    try {
      return (await gpu.requestAdapter()) !== null;
    } catch {
      return false;
    }
  });
}
