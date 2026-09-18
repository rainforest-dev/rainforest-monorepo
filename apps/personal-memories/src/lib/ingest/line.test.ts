import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { LINE_PLACEHOLDERS, parseLineChat } from './line.ts';

const chat = parseLineChat(
  readFileSync(
    join(import.meta.dirname, '__fixtures__', 'line-chat.txt'),
    'utf8',
  ),
);

describe('parseLineChat', () => {
  it('reads the header name with its emoji', () => {
    expect(chat.chatWith).toBe('Alice 🌷');
  });

  it('parses every message line, multi-line quotes as one event', () => {
    expect(chat.events).toHaveLength(13);
    expect(chat.events.every((e) => e.source === 'line')).toBe(true);
  });

  it('converts the 12-hour clock to +08:00 timestamps in order', () => {
    const at = chat.events.map((e) => e.at);
    expect(at[0]).toBe('2025-11-01T00:05:00+08:00');
    expect(at[2]).toBe('2025-11-01T09:30:00+08:00');
    expect(at[4]).toBe('2025-11-01T12:00:00+08:00');
    expect(at.at(-1)).toBe('2025-11-02T23:59:00+08:00');
    expect([...at].sort()).toEqual(at);
    expect(at.every((t) => t.endsWith('+08:00'))).toBe(true);
  });

  it('keeps authors literally, emoji included', () => {
    expect(chat.events[0].author).toBe('Alice 🌷');
    expect(chat.events[1].author).toBe('Bob');
  });

  it('joins a quoted multi-line message and undoubles quotes', () => {
    expect(chat.events[4].text).toBe(
      'Lunch plan:\n1. noodles\n2. the "good" tea place\nsee you at 1',
    );
    expect(chat.events[5].text).toBe('Sounds good');
  });

  it('keeps unsent-message lines as system events', () => {
    const system = chat.events.filter((e) => e.author === 'system');
    expect(system.map((e) => e.text)).toEqual([
      'You unsent a message.',
      'Alice 🌷 unsent a message.',
    ]);
  });

  it('turns placeholders into text-only events', () => {
    const placeholders = chat.events.filter((e) =>
      (LINE_PLACEHOLDERS as readonly string[]).includes(e.text ?? ''),
    );
    expect(new Set(placeholders.map((e) => e.text))).toEqual(
      new Set(LINE_PLACEHOLDERS),
    );
    expect(placeholders.every((e) => e.media === undefined)).toBe(true);
  });

  it('produces stable ids across runs', () => {
    const again = parseLineChat(
      readFileSync(
        join(import.meta.dirname, '__fixtures__', 'line-chat.txt'),
        'utf8',
      ),
    );
    expect(again.events.map((e) => e.id)).toEqual(chat.events.map((e) => e.id));
  });

  it('does not let an unclosed quote swallow later messages', () => {
    const { events } = parseLineChat(
      'Sat, 11/01/2025\n10:00AM\tAlice\t"half a thought\n10:01AM\tBob\tok\n',
    );
    expect(events.map((e) => e.text)).toEqual(['"half a thought', 'ok']);
  });
});
