import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'];

export interface AxeIgnore {
  rule: string;
  targetIncludes: string;
}

export async function expectNoViolations(
  page: Page,
  options?: { ignore?: AxeIgnore[] },
): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) =>
          Number.isFinite(
            Number(animation.effect?.getComputedTiming().endTime),
          ),
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  const ignore = options?.ignore ?? [];
  const remaining = violations
    .map((v) => ({
      ...v,
      nodes: v.nodes.filter(
        (n) =>
          !ignore.some(
            (i) =>
              i.rule === v.id &&
              n.target.some((t) => t.includes(i.targetIncludes)),
          ),
      ),
    }))
    .filter((v) => v.nodes.length > 0);
  expect(
    remaining.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    ),
  ).toEqual([]);
}
