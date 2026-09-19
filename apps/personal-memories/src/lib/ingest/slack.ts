import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import { makeEvent, type TimelineEvent, toTaipeiIso } from '../timeline.ts';

type SlackUser = {
  id: string;
  name?: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string };
};

type SlackMessage = {
  type?: string;
  subtype?: string;
  user?: string;
  text?: string;
  ts?: string;
  files?: { name?: string }[];
};

export type SlackExport = {
  events: TimelineEvent[];
  skipped: number;
};

const DAY_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8'));

export function readSlackUsers(root: string): Map<string, string> {
  const names = new Map<string, string>();
  const path = join(root, 'users.json');
  if (!existsSync(path)) return names;
  for (const user of readJson(path) as SlackUser[]) {
    const name =
      user.profile?.display_name ||
      user.profile?.real_name ||
      user.real_name ||
      user.name;
    if (user.id && name) names.set(user.id, name);
  }
  return names;
}

function findMedia(root: string, channel: string, fileName: string) {
  const name = basename(fileName);
  for (const rel of [join(channel, name), join('files', name), name]) {
    if (existsSync(join(root, rel))) return rel;
  }
  return undefined;
}

/** Parses a standard Slack export directory (`users.json`, `<channel>/<date>.json`). */
export function parseSlackExport(root: string): SlackExport {
  const users = readSlackUsers(root);
  const result: SlackExport = { events: [], skipped: 0 };

  const channels = readdirSync(root)
    .filter((entry) => statSync(join(root, entry)).isDirectory())
    .sort();

  for (const channel of channels) {
    const days = readdirSync(join(root, channel))
      .filter((file) => DAY_FILE.test(file))
      .sort();

    for (const day of days) {
      const messages = readJson(join(root, channel, day));
      if (!Array.isArray(messages)) continue;

      for (const message of messages as SlackMessage[]) {
        const seconds = Number(message.ts);
        if (
          message.type !== 'message' ||
          (message.subtype !== undefined && message.subtype !== 'file_share') ||
          !Number.isFinite(seconds)
        ) {
          result.skipped++;
          continue;
        }

        const text = (message.text ?? '').replace(
          /<@([A-Z0-9]+)>/g,
          (mention, id: string) =>
            users.has(id) ? `@${users.get(id)}` : mention,
        );
        const media = (message.files ?? [])
          .map((file) => file.name && findMedia(root, channel, file.name))
          .filter((path): path is string => Boolean(path))
          .map((path) => ({ path }));

        result.events.push(
          makeEvent({
            source: 'slack',
            at: toTaipeiIso(Math.round(seconds * 1000)),
            author:
              (message.user && users.get(message.user)) ||
              message.user ||
              'unknown',
            text: text || undefined,
            media,
          }),
        );
      }
    }
  }

  return result;
}
