import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Relative, not @/: src/cli runs under plain `node`, which does not read tsconfig paths.
import { writePhotoFixture } from '../lib/ingest/__fixtures__/photos.ts';
import { fakeEmbedder } from '../lib/server/embed.ts';
import type { Timeline } from '../lib/server/timeline.ts';
import { buildIndex, ingest } from './ingest.ts';

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
12:10PM\tBob\t台南的拉麵好好吃
12:12PM\tAlice\t下次再去
`;

const PEOPLE = {
  owner: 'bob',
  people: [
    {
      id: 'bob',
      name: 'Bob',
      emails: ['bob@example.com'],
      aliases: { slack: ['bob'] },
    },
    {
      id: 'alice',
      name: 'Alice',
      emails: ['alice@example.com'],
      aliases: { slack: ['alice'] },
    },
  ],
};

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

const slackEvent = (timeline: Timeline, author: string, text: string) => {
  const event = timeline.events.find(
    (e) => e.source === 'slack' && e.author === author && e.text === text,
  );
  if (!event)
    throw new Error(`fixture has no Slack message "${text}" by ${author}`);
  return event.id;
};

export function writeMarkerFixture(root: string, timeline: Timeline) {
  const morning = slackEvent(timeline, 'Bob', 'Morning @Alice');
  const reply = slackEvent(timeline, 'Alice', 'Thread reply');
  const markers = [
    {
      date: '2025-11-01',
      person: 'bob',
      kind: 'wfh',
      part: 'full',
      event: morning,
    },
    {
      date: '2025-11-03',
      person: 'alice',
      kind: 'leave',
      part: 'am',
      event: reply,
    },
    {
      date: '2025-11-03',
      person: 'alice',
      kind: 'wfh',
      part: 'pm',
      event: reply,
    },
    {
      date: '2025-11-04',
      person: 'alice',
      kind: 'leave',
      part: 'full',
      event: reply,
    },
  ];
  writeFileSync(
    join(root, 'markers.json'),
    JSON.stringify({ markers }, null, 2),
  );
}

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
  writeFileSync(join(root, 'people.json'), JSON.stringify(PEOPLE, null, 2));
  const timeline = ingest(root, () => undefined);
  writeMarkerFixture(root, timeline);
  return timeline;
}

if (import.meta.main) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node src/cli/fixture.ts <empty-dir>');
    process.exit(2);
  }
  const timeline = writeFixtureDataDir(resolve(target));
  await buildIndex(resolve(target), timeline, fakeEmbedder(), () => undefined);
  console.log(`fixture: ${timeline.events.length} events → ${resolve(target)}`);
}
