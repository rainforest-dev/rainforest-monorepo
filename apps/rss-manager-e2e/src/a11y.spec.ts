import { test } from '@playwright/test';

import { type AxeIgnore, expectNoViolations } from './support/axe';
import { gotoTab, type Tab } from './support/desk';
import { resetVault } from './support/vault';

test.beforeEach(() => resetVault());

const PAGE_WITHOUT_LANDMARKS: AxeIgnore[] = [
  { rule: 'landmark-one-main', targetIncludes: '' },
  { rule: 'region', targetIncludes: '' },
];

const PRE_REDESIGN_VIOLATIONS: Record<Tab, AxeIgnore[]> = {
  sources: PAGE_WITHOUT_LANDMARKS,
  topics: [
    ...PAGE_WITHOUT_LANDMARKS,
    { rule: 'heading-order', targetIncludes: '' },
    { rule: 'color-contrast', targetIncludes: 'bg-success' },
  ],
  validate: PAGE_WITHOUT_LANDMARKS,
  queue: [
    ...PAGE_WITHOUT_LANDMARKS,
    { rule: 'heading-order', targetIncludes: '' },
  ],
};

test.describe('accessibility', () => {
  for (const [tab, ignore] of Object.entries(PRE_REDESIGN_VIOLATIONS)) {
    test(`the ${tab} tab has no axe violations beyond the known ones`, async ({
      page,
    }) => {
      await gotoTab(page, tab as Tab);
      await expectNoViolations(page, { ignore });
    });
  }
});
