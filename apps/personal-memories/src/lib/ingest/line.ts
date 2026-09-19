import { makeEvent, taipeiWallClock, type TimelineEvent } from '../timeline.ts';

export const LINE_PLACEHOLDERS = [
  '[Photo]',
  '[Sticker]',
  '[Video]',
  '[Voice message]',
  '[File]',
  '[Gift]',
] as const;

export type LineChat = {
  /** Name from the `[LINE] Chat history with <name>` header, if present. */
  chatWith?: string;
  events: TimelineEvent[];
};

const HEADER = /^\[LINE\] Chat history with (.*)$/;
const DATE_HEADER =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2})\/(\d{2})\/(\d{4})$/;
const MESSAGE = /^(\d{1,2}):(\d{2})(AM|PM)\t(.*)$/;

type Day = { year: number; month: number; day: number };

const to24h = (hour: number, meridiem: string) =>
  (hour % 12) + (meridiem === 'PM' ? 12 : 0);

/**
 * Reads a quoted multi-line body starting at `lines[start]` (whose first char
 * is `"`). Returns the unquoted text and the index of the last consumed line,
 * or `undefined` when the quote never closes cleanly at a line end.
 */
function readQuoted(
  lines: string[],
  start: number,
): { text: string; end: number } | undefined {
  let text = '';
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (i > start) {
      if (DATE_HEADER.test(line) || MESSAGE.test(line)) return undefined;
      text += '\n';
    }
    for (let c = i === start ? 1 : 0; c < line.length; c++) {
      if (line[c] !== '"') {
        text += line[c];
      } else if (line[c + 1] === '"') {
        text += '"';
        c++;
      } else {
        return c === line.length - 1 ? { text, end: i } : undefined;
      }
    }
  }
  return undefined;
}

/** Parses an English-locale LINE chat export (`[LINE] Chat history with …`). */
export function parseLineChat(source: string): LineChat {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  const chat: LineChat = { events: [] };
  let day: Day | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const header = HEADER.exec(line);
    if (header && chat.chatWith === undefined) {
      chat.chatWith = header[1];
      continue;
    }

    const date = DATE_HEADER.exec(line);
    if (date) {
      day = {
        month: Number(date[1]),
        day: Number(date[2]),
        year: Number(date[3]),
      };
      continue;
    }

    const message = MESSAGE.exec(line);
    if (!message || !day) continue;

    const [, hh, mm, meridiem, rest] = message;
    const tab = rest.indexOf('\t');
    // A line without the second tab carries no author field at all.
    let author = tab === -1 ? '' : rest.slice(0, tab);
    let text = tab === -1 ? rest : rest.slice(tab + 1);
    if (author === '') author = 'system';

    if (text.startsWith('"')) {
      const quoted = readQuoted([text, ...lines.slice(i + 1)], 0);
      if (quoted) {
        text = quoted.text;
        i += quoted.end;
      }
    }

    chat.events.push(
      makeEvent({
        source: 'line',
        at: taipeiWallClock(
          day.year,
          day.month,
          day.day,
          to24h(Number(hh), meridiem),
          Number(mm),
        ),
        author,
        text,
      }),
    );
  }

  return chat;
}
