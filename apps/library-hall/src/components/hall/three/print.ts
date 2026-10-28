import { type Rgb } from '@/components/study/three/tokens';

/**
 * What is printed on the rack's covers and the stand's papers, drawn into canvases the scene
 * uses as textures. Pure drawing, so it runs the same in a test canvas.
 */

/** Canvas sizes, in the proportions of `RACK_COVER` and `PAPER`. */
export const COVER_PX = { w: 256, h: 290 } as const;
export const PAPER_PX = { w: 256, h: 346 } as const;

/** Ink and newsprint: a paper is a physical thing and stays light in a dark theme. */
const NEWSPRINT = '#f3efe4';
const INK = '#1f1d1a';
const GREY_INK = 'rgba(31, 29, 26, 0.28)';

const CJK = '⺀-鿿豈-﫿＀-￯';
const PIECES = new RegExp(`[${CJK}]|[^\\s${CJK}]+\\s*|\\s+`, 'g');

export function css([r, g, b]: Rgb, alpha = 1): string {
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Black or white, whichever reads on `rgb`. */
function inkOn([r, g, b]: Rgb): string {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? INK : '#ffffff';
}

/**
 * `text` broken into at most `maxLines` lines no wider than `width`: between words, or between
 * any two CJK characters. A cut-off last line ends with an ellipsis.
 */
export function wrapLines(
  ctx: Pick<CanvasRenderingContext2D, 'measureText'>,
  text: string,
  width: number,
  maxLines: number,
): string[] {
  const fits = (line: string) => ctx.measureText(line).width <= width;
  // A word too long for a line on its own breaks anywhere.
  const pieces = (text.trim().match(PIECES) ?? []).flatMap((piece) =>
    fits(piece.trimEnd()) ? [piece] : [...piece],
  );
  const lines: string[] = [];
  let line = '';
  let cut = false;
  for (const piece of pieces) {
    const next = line + piece;
    if (!line || fits(next.trimEnd())) {
      line = next;
      continue;
    }
    lines.push(line.trimEnd());
    line = piece.trimStart();
    if (lines.length === maxLines) {
      cut = true;
      break;
    }
  }
  if (!cut && line.trim()) lines.push(line.trimEnd());
  if (cut) {
    let last = lines[lines.length - 1] ?? '';
    while (last && !fits(`${last}…`)) last = [...last].slice(0, -1).join('');
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function fontFamily(): string {
  try {
    return getComputedStyle(document.body).fontFamily || 'sans-serif';
  } catch {
    return 'sans-serif';
  }
}

/** Draws `image` to fill the box, cropping what does not fit, like CSS `object-fit: cover`. */
function drawCovering(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  w: number,
  h: number,
) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(
    image,
    (image.width - sw) / 2,
    (image.height - sh) / 2,
    sw,
    sh,
    0,
    0,
    w,
    h,
  );
}

/**
 * A magazine cover: the event's picture with its title across the head, or, without a picture,
 * the title large on the shelf's colour.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  title: string,
  tint: Rgb,
  image: HTMLImageElement | null,
) {
  const { w, h } = COVER_PX;
  const family = fontFamily();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = css(tint);
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  if (image && image.width > 0) {
    drawCovering(ctx, image, w, h);
    // The rack's lip hides a cover's foot, so the title runs along the head.
    const head = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    head.addColorStop(0, 'rgba(0, 0, 0, 0.82)');
    head.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = head;
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.font = `700 26px ${family}`;
    ctx.fillStyle = '#ffffff';
    wrapLines(ctx, title, w - 28, 2).forEach((line, i) =>
      ctx.fillText(line, 14, 38 + i * 31),
    );
    return;
  }
  // A band across the top, as a masthead, and the title under it.
  const ink = inkOn(tint);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(14, 16, w - 28, 6);
  ctx.globalAlpha = 1;
  ctx.font = `700 30px ${family}`;
  wrapLines(ctx, title, w - 28, 6).forEach((line, i) =>
    ctx.fillText(line, 14, 62 + i * 36),
  );
}

/**
 * A newspaper: its site's name as the masthead over a double rule, the article's title as the
 * headline, and grey lines for the columns below.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  masthead: string | null,
  headline: string,
) {
  const { w, h } = PAPER_PX;
  const family = fontFamily();
  const pad = 14;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = NEWSPRINT;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.font = `700 26px Georgia, 'Noto Serif TC', serif`;
  const [name = ''] = wrapLines(ctx, masthead ?? '', w - pad * 2, 1);
  ctx.fillText(name, w / 2, 38);
  ctx.textAlign = 'start';
  ctx.fillRect(pad, 48, w - pad * 2, 3);
  ctx.fillRect(pad, 54, w - pad * 2, 1);
  ctx.font = `700 26px ${family}`;
  const lines = wrapLines(ctx, headline, w - pad * 2, 4);
  lines.forEach((line, i) => ctx.fillText(line, pad, 88 + i * 32));
  // The columns, as lines of grey type.
  ctx.fillStyle = GREY_INK;
  const top = 88 + lines.length * 32;
  const column = (w - pad * 3) / 2;
  for (let c = 0; c < 2; c++)
    for (let y = top; y < h - pad; y += 11) {
      const ragged = (y * 7 + c * 13) % 5 === 0 ? 0.6 : 1;
      ctx.fillRect(pad + c * (column + pad), y, column * ragged, 4);
    }
}
