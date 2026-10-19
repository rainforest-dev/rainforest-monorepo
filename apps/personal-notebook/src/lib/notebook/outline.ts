/** The fields of a page the outline and links read: what OCR or a person wrote into it. */
export interface PageText {
  id: number;
  position: number;
  pageNumber: number | null;
  pageDate: string | null;
  transcription: string | null;
}

export type OutlineGroup = 'setup' | 'collection' | 'daily';

export interface OutlineEntry {
  pageId: number;
  /** The number a reader sees on the page: its printed number, else its position. */
  number: number;
  title: string;
  group: OutlineGroup;
}

export interface OutlineSection {
  group: OutlineGroup;
  label: string;
  entries: OutlineEntry[];
}

const TITLE_MAX = 80;
const MARKER = /^\s*(?:#{1,6}\s+|>\s*|[-*+•·]\s+|\d+\.\s+)/;

export const pageNumberOf = (page: Pick<PageText, 'pageNumber' | 'position'>) =>
  page.pageNumber ?? page.position;

/** The page's first non-empty line, without list or heading markers. */
export function pageHeading(transcription: string | null): string | undefined {
  if (!transcription) return undefined;
  for (const raw of transcription.split('\n')) {
    const line = raw
      .replace(MARKER, '')
      .replace(/\*\*|__/g, '')
      .trim();
    if (line) {
      const chars = Array.from(line);
      return chars.length > TITLE_MAX
        ? `${chars.slice(0, TITLE_MAX - 1).join('')}…`
        : line;
    }
  }
  return undefined;
}

const MONTHS =
  'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const SETUP = [
  /^(?:index|contents|table of contents|key|legend)\b/i,
  /^(?:索引|目錄|目录|圖例)/,
  /future\s*log|年度|未來/i,
  new RegExp(`^(?:${MONTHS})\\.?(?:\\s+\\d{4})?(?:\\s+(?:log|monthly))?$`, 'i'),
  /^\d{4}\s*年\s*\d{1,2}\s*月$|^\d{1,2}\s*月(?:\s*(?:log|計畫|計劃))?$/,
  /^\d{4}[-/.]\d{1,2}$/,
];
const DAILY = [
  /\b\d{1,2}[/.-]\d{1,2}\b/,
  /\b(?:sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs?(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/i,
  /(?:星期|週|周|禮拜)[一二三四五六日天]/,
  new RegExp(`\\b(?:${MONTHS})\\.?\\s+\\d{1,2}\\b`, 'i'),
];

export function classifyPage(
  title: string,
  pageDate: string | null,
): OutlineGroup {
  if (SETUP.some((re) => re.test(title))) return 'setup';
  if (pageDate || DAILY.some((re) => re.test(title))) return 'daily';
  return 'collection';
}

const SECTIONS: readonly { group: OutlineGroup; label: string }[] = [
  { group: 'setup', label: 'Setup' },
  { group: 'collection', label: 'Collections' },
  { group: 'daily', label: 'Daily' },
];

/**
 * A table of contents built from each page's first line, grouped the way a bullet journal is laid
 * out: index, future and monthly logs first, then collections, then daily logs. Pages with no text
 * yet are left out; they join once OCR or a person fills them in.
 */
export function notebookOutline(pages: readonly PageText[]): OutlineSection[] {
  const sections = SECTIONS.map(({ group, label }) => ({
    group,
    label,
    entries: [] as OutlineEntry[],
  }));
  for (const page of pages) {
    const title = pageHeading(page.transcription);
    if (!title) continue;
    const group = classifyPage(title, page.pageDate);
    sections
      .find((section) => section.group === group)
      ?.entries.push({
        pageId: page.id,
        number: pageNumberOf(page),
        title,
        group,
      });
  }
  return sections.filter((section) => section.entries.length > 0);
}
