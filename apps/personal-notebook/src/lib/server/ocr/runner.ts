import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';

import { appDb, notebookPages, notebooks } from '@/db';
import { notInTrash, readPageFile } from '@/lib/server/notebooks';

import type { OcrEngine } from './engine';
import { parseOcr } from './parse';

/** Failed runs before the worker leaves a page for a person; replacing the image resets it. */
export const MAX_OCR_ATTEMPTS = 3;
/** A cold 8B vision model took up to two minutes on one page; past this it is stuck. */
const READ_TIMEOUT_MS = 5 * 60_000;

const errorText = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 500);

/**
 * The oldest page with no transcription that OCR has not yet given up on, skipping notebooks
 * in Trash.
 */
export function nextPageForOcr(): number | undefined {
  return appDb
    .select({ id: notebookPages.id })
    .from(notebookPages)
    .innerJoin(notebooks, eq(notebooks.id, notebookPages.notebookId))
    .where(
      and(
        isNull(notebookPages.transcription),
        lt(notebookPages.ocrAttempts, MAX_OCR_ATTEMPTS),
        notInTrash,
      ),
    )
    .orderBy(asc(notebookPages.id))
    .limit(1)
    .get()?.id;
}

/** Matches the page only while it still holds the image that was read. */
const sameImage = (pageId: number, contentHash: string | undefined) =>
  contentHash === undefined
    ? eq(notebookPages.id, pageId)
    : and(
        eq(notebookPages.id, pageId),
        eq(notebookPages.contentHash, contentHash),
      );

function recordFailure(
  pageId: number,
  contentHash: string | undefined,
  error: unknown,
): void {
  appDb
    .update(notebookPages)
    .set({
      ocrAttempts: sql`${notebookPages.ocrAttempts} + 1`,
      ocrError: errorText(error),
    })
    .where(sameImage(pageId, contentHash))
    .run();
}

/**
 * Reads the next waiting page. Only an empty transcription is written, so a page someone
 * transcribed while the model was reading keeps theirs; a date or number already set is kept too.
 * A page whose image was replaced mid-read gets neither the old text nor a charged attempt.
 */
export async function ocrNextPage(
  engine: OcrEngine,
): Promise<'read' | 'failed' | 'idle'> {
  const pageId = nextPageForOcr();
  if (pageId === undefined) return 'idle';
  let contentHash: string | undefined;
  try {
    const file = await readPageFile(pageId);
    if (!file) throw new Error('page image is missing');
    contentHash = file.contentHash;
    const result = parseOcr(
      await engine.read(file.data, AbortSignal.timeout(READ_TIMEOUT_MS)),
    );
    if (!result.transcription) throw new Error('the model returned no text');
    appDb
      .update(notebookPages)
      .set({
        transcription: result.transcription,
        transcribedAt: new Date().toISOString(),
        transcribedBy: `ocr:${engine.name}`,
        pageDate: sql`coalesce(${notebookPages.pageDate}, ${result.pageDate})`,
        pageNumber: sql`coalesce(${notebookPages.pageNumber}, ${result.pageNumber})`,
        ocrError: null,
      })
      .where(
        and(
          sameImage(pageId, contentHash),
          isNull(notebookPages.transcription),
        ),
      )
      .run();
    return 'read';
  } catch (error) {
    recordFailure(pageId, contentHash, error);
    return 'failed';
  }
}

export interface OcrWorkerOptions {
  intervalMs?: number;
  log?: Pick<Console, 'info' | 'warn'>;
}

const WORKER = Symbol.for('personal-calibre.ocr-worker');
type WorkerHost = typeof globalThis & { [WORKER]?: () => void };

/**
 * Reads waiting pages one at a time, then checks again every `intervalMs`. One page at a time
 * keeps a single vision model loaded on the host. While the engine is unreachable no page is
 * charged an attempt. Starting twice in one process returns the running worker's stop.
 */
export function startOcrWorker(
  engine: OcrEngine,
  { intervalMs = 60_000, log = console }: OcrWorkerOptions = {},
): () => void {
  const host = globalThis as WorkerHost;
  const running = host[WORKER];
  if (running) return running;

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastProblem: string | undefined;

  async function tick(): Promise<void> {
    try {
      if (nextPageForOcr() === undefined) return;
      await engine.ready();
      if (lastProblem) log.info(`[ocr] ${engine.name} is reachable again`);
      lastProblem = undefined;
      while (!stopped) {
        const outcome = await ocrNextPage(engine);
        if (outcome === 'idle') break;
        if (outcome === 'failed') log.warn(`[ocr] a page failed to read`);
      }
    } catch (error) {
      const problem = errorText(error);
      if (problem !== lastProblem)
        log.warn(`[ocr] ${engine.name} is not ready: ${problem}`);
      lastProblem = problem;
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void tick(), intervalMs);
        timer.unref?.();
      }
    }
  }

  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (host[WORKER] === stop) delete host[WORKER];
  };
  host[WORKER] = stop;
  log.info(`[ocr] reading notebook pages with ${engine.name}`);
  void tick();
  return stop;
}
