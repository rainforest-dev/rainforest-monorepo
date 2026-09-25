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

const BUSY_DAY = [
  '[LINE] Chat history with Alice',
  'Saved on: 11/01/2025, 08:00',
  '',
  'Fri, 10/31/2025',
  ...Array.from({ length: 120 }, (_, i) => {
    const hour = 7 + Math.floor(i / 10);
    const minute = String((i % 10) * 5).padStart(2, '0');
    const clock = `${hour % 12 || 12}:${minute}${hour < 12 ? 'AM' : 'PM'}`;
    return `${clock}\t${i % 2 ? 'Bob' : 'Alice'}\tBusy message ${i + 1}`;
  }),
  '',
].join('\n');

/**
 * Builds a synthetic data directory from the parser fixtures and ingests it.
 * Used by the e2e tests and for screenshots; never touches real data.
 */
export function writeFixtureDataDir(root: string) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'line'), { recursive: true });
  cpSync(join(FIXTURES, 'line-chat.txt'), join(root, 'line', 'chat.txt'));
  writeFileSync(join(root, 'line', 'second-week.txt'), SECOND_WEEK);
  writeFileSync(join(root, 'line', 'busy-day.txt'), BUSY_DAY);
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
