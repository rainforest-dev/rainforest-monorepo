import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const DATA = path.join(__dirname, '..', 'test-output', 'fixture-data');
const TIMELINE = path.join(DATA, 'timeline.json');
const PEOPLE = path.join(DATA, 'people.json');
const NEW_DAY = '2025-11-05';

type Event = { id: string; at: string; source: string; text?: string };

const replace = (file: string, contents: string) => {
  writeFileSync(`${file}.tmp`, contents);
  renameSync(`${file}.tmp`, file);
};

test.describe.configure({ mode: 'serial' });

let timeline: string;
let people: string;

test.beforeAll(() => {
  timeline = readFileSync(TIMELINE, 'utf8');
  people = readFileSync(PEOPLE, 'utf8');
});

test.afterAll(() => {
  replace(TIMELINE, timeline);
  replace(PEOPLE, people);
});

test('a rewritten timeline.json shows its new day without a restart', async ({
  page,
}) => {
  expect((await page.goto(`/day/${NEW_DAY}`))?.status()).toBe(404);

  const parsed = JSON.parse(timeline) as { events: Event[] };
  const line = parsed.events.find((e) => e.source === 'line');
  if (!line) throw new Error('the fixture has no LINE event');
  parsed.events.push({
    ...line,
    id: 'reload-e2e',
    at: `${NEW_DAY}T09:00:00+08:00`,
    text: 'Picked up after a reload',
  });
  replace(TIMELINE, JSON.stringify(parsed));

  await expect(async () => {
    expect((await page.goto(`/day/${NEW_DAY}`))?.status()).toBe(200);
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText('Picked up after a reload')).toBeVisible();
});

test('an edited people.json changes /people.json without a restart', async ({
  request,
}) => {
  const edited = people.replace('"name": "Alice"', '"name": "Alicia"');
  expect(edited).not.toBe(people);
  replace(PEOPLE, edited);

  await expect(async () => {
    const roster = (await (await request.get('/people.json')).json()) as {
      name: string;
    }[];
    expect(roster.map((p) => p.name)).toContain('Alicia');
  }).toPass({ timeout: 15_000 });
});
