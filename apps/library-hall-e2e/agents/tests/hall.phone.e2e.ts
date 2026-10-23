import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('a phone gets the bookcase list and the bottom tab bar', async ({
  app,
  agent,
  browser,
  screen,
}) => {
  await browser.setViewport({ width: 390, height: 844 });
  await app.open('/');
  await expect(screen.getByRole('button', '進入 3D 大廳')).toBeVisible();
  await agent.assert(
    'the bookcases are shown as cards under the heading 主題, which notes 1 件沒有主題, with cards such as sea and winter, and a tab bar at the bottom switches collections',
    { vision: true },
  );
});
