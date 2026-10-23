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
    'the bookcases are listed one per row, grouped under 書, 筆記本, 報架 and 知識庫, and a tab bar at the bottom switches collections',
    { vision: true },
  );
});
