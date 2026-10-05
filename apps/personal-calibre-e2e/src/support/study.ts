import { expect, type Locator, type Page, test } from '@playwright/test';

export type StudyRun =
  { renderer: 'css' } | { renderer: 'three-tsl'; backend: 'webgpu' | 'webgl2' };

export const STUDY_RUNS: readonly StudyRun[] = [
  { renderer: 'three-tsl', backend: 'webgpu' },
  { renderer: 'three-tsl', backend: 'webgl2' },
  { renderer: 'css' },
];

const STUDY_READY_MS = 15_000;

const CONSOLE_ALLOWLIST: readonly RegExp[] = [
  /THREE\.Clock/,
  // Headless Chromium logs this for any composited WebGL canvas.
  /GL Driver Message .*GPU stall due to ReadPixels/,
];

export function runName(run: StudyRun): string {
  return run.renderer === 'css' ? 'css' : `${run.renderer}-${run.backend}`;
}

const PROJECT_RUNS: Readonly<Record<string, readonly string[]>> = {
  chromium: ['css', 'three-tsl-webgl2'],
  'study-webgpu': ['three-tsl-webgpu'],
};

export function runsOn(project: string, run: StudyRun): boolean {
  return PROJECT_RUNS[project]?.includes(runName(run)) ?? false;
}

export async function startRun(page: Page, run: StudyRun): Promise<void> {
  const project = test.info().project.name;
  test.skip(
    !runsOn(project, run),
    `${runName(run)} does not run on ${project}`,
  );
  await prepareRun(page, run);
  if (run.renderer === 'three-tsl' && run.backend === 'webgpu') {
    await page.goto('/favicon.ico');
    test.skip(!(await hasWebGpu(page)), 'this browser has no WebGPU adapter');
  }
}

export async function expectPulledFocus(
  page: Page,
  run: StudyRun,
): Promise<void> {
  const active = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset['bookId'],
  );
  expect(active).toBeDefined();
  if (run.renderer !== 'css') {
    await expect(canvasWrap(page)).toHaveAttribute(
      'data-pulled-id',
      active ?? '',
    );
  }
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
  await expect(page.locator('[data-study-ready]')).toHaveCount(1, {
    timeout: STUDY_READY_MS,
  });
  await expect(page.locator('[data-view-ready]')).toHaveCount(1);
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

export interface HeadingFade {
  pulledId: string;
  overlapping: number[];
  faded: number[];
  hiddenOpacity: boolean;
}

export function headingFade(page: Page): Promise<HeadingFade> {
  return page.evaluate(() => {
    type Rect = { left: number; top: number; width: number; height: number };
    const probe = (
      window as Window & {
        __calibreStudy?: { projectBook: (id: number) => Rect | null };
      }
    ).__calibreStudy;
    const pulledId =
      document
        .querySelector('[data-study-canvas]')
        ?.getAttribute('data-pulled-id') ?? '';
    const book = pulledId ? probe?.projectBook(Number(pulledId)) : null;
    const labels = [
      ...document.querySelectorAll<HTMLElement>('[data-shelf-label]'),
    ];
    const overlaps = (a: Rect, b: DOMRect) =>
      a.left < b.right &&
      b.left < a.left + a.width &&
      a.top < b.bottom &&
      b.top < a.top + a.height;
    const indices = (keep: (label: HTMLElement) => boolean) =>
      labels.flatMap((label, i) => (keep(label) ? [i] : []));
    const faded = indices((label) => label.hasAttribute('data-faded'));
    return {
      pulledId,
      overlapping: indices(
        (label) => !!book && overlaps(book, label.getBoundingClientRect()),
      ),
      faded,
      hiddenOpacity: faded.every(
        (i) => getComputedStyle(labels[i] as HTMLElement).opacity === '0',
      ),
    };
  });
}
