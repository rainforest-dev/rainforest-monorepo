import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { writePhotoFixture } from '../lib/ingest/__fixtures__/photos.ts';
import { ingest } from './ingest.ts';

const FIXTURES = join(
  import.meta.dirname,
  '..',
  'lib',
  'ingest',
  '__fixtures__',
);

const SECOND_WEEK = `[LINE] Chat history with Alice
Saved on: 11/04/2025, 08:00

Mon, 11/03/2025
8:15AM\tAlice\tNew week, new plans
8:20AM\tBob\tCoffee first
`;

/**
 * Builds a synthetic data directory from the parser fixtures and ingests it.
 * Used by the e2e tests and for screenshots; never touches real data.
 */
export function writeFixtureDataDir(root: string) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'line'), { recursive: true });
  cpSync(join(FIXTURES, 'line-chat.txt'), join(root, 'line', 'chat.txt'));
  writeFileSync(join(root, 'line', 'second-week.txt'), SECOND_WEEK);
  cpSync(join(FIXTURES, 'slack'), join(root, 'slack'), { recursive: true });
  writePhotoFixture(root);
  return ingest(root, () => undefined);
}

if (import.meta.main) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node src/cli/fixture.ts <empty-dir>');
    process.exit(2);
  }
  const { events } = writeFixtureDataDir(resolve(target));
  console.log(`fixture: ${events.length} events → ${resolve(target)}`);
}
