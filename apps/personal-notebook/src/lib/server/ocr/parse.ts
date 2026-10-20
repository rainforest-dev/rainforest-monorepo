export interface OcrResult {
  transcription: string;
  /** The first date written on the page, YYYY-MM-DD. */
  pageDate: string | null;
  /** The number printed on the page. */
  pageNumber: number | null;
}

const FIELD = /^(DATE|PAGE|HEADINGS|TEXT)\s*[:：]\s*(.*)$/i;
const NONE = /^(none|無|没有|沒有|n\/a|-)?$/i;

function realDate(text: string): string | null {
  const match = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (!match) return null;
  const [, y, m, d] = match;
  const iso = `${y}-${m?.padStart(2, '0')}-${d?.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso)
    ? iso
    : null;
}

/**
 * Handwritten `x` (done) bullets come back as 「人」 from every local model tried, so a line that
 * starts with 「人」 and a space is read as one. A 「人」 that begins a word is left alone.
 */
const fixBullet = (line: string) => line.replace(/^(\s*)人(?=\s)/, '$1x');

/**
 * Reads a model's answer to `OCR_PROMPT`. Headings lead the transcription, so the page's first
 * line is its heading as the outline expects. An answer that ignores the format is kept whole as
 * text, with no date or number.
 */
export function parseOcr(raw: string): OcrResult {
  // Code fences some models wrap their answer in carry nothing.
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !line.trim().startsWith('```'));
  let date = '';
  let page = '';
  const headings: string[] = [];
  const body: string[] = [];
  let section: 'none' | 'headings' | 'text' = 'none';
  let structured = false;

  for (const line of lines) {
    const field = section === 'text' ? null : FIELD.exec(line.trim());
    if (field) {
      structured = true;
      const [, name = '', value = ''] = field;
      const key = name.toUpperCase();
      if (key === 'DATE') date = value.trim();
      else if (key === 'PAGE') page = value.trim();
      else if (key === 'HEADINGS') {
        section = 'headings';
        headings.push(...value.split(/[,，、]/));
      } else {
        section = 'text';
        if (value.trim()) body.push(value);
      }
      continue;
    }
    if (section === 'headings') headings.push(line);
    else if (section === 'text' || !structured) body.push(line);
  }

  const heads = headings.map((h) => h.trim()).filter((h) => h && !NONE.test(h));
  const text = body.map((line) => fixBullet(line.trimEnd()));
  while (text.length && !text[0]?.trim()) text.shift();
  while (text.length && !text.at(-1)?.trim()) text.pop();
  // Skip headings the text already opens with.
  const first = text[0]?.trim() ?? '';
  const lead = heads.filter((h) => !first.includes(h));
  const transcription = [
    ...lead,
    ...(lead.length && text.length ? [''] : []),
    ...text,
  ]
    .join('\n')
    .trim();

  const number = /^\d{1,4}$/.exec(page)?.[0];
  return {
    transcription,
    pageDate: NONE.test(date) ? null : realDate(date),
    pageNumber: number && Number(number) > 0 ? Number(number) : null,
  };
}
