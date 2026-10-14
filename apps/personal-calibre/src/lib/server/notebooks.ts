import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ToolInputError } from '@rainforest-dev/mcp-kit';
import { and, asc, count, eq, isNotNull, isNull, max, sql } from 'drizzle-orm';

import { appDb, appDbPath, notebookPages, notebooks } from '@/db';
import type {
  AppendPagesResult,
  Notebook,
  NotebookDetail,
  NotebookPage,
  NotebookStatus,
  NotebookSummary,
  PageTranscriptionInput,
  SkippedPage,
} from '@/types';

import {
  fingerprintPage,
  inkOf,
  MIN_INK,
  pageSimilarity,
  SAME_PAGE_SIMILARITY,
} from './page-fingerprint';
import { normalizePageImage, type PageImage } from './page-image';
import { extractPdfPages, isPdf, MAX_PDF_BYTES } from './pdf-pages';

export const MAX_PAGE_BYTES = 25 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
};

const GENERIC_TYPES = new Set(['', 'application/octet-stream']);

/** Why `checkPageUpload` refuses a PDF: `readPageUploads` splits one into page images first. */
export const PDF_NOT_EXPANDED =
  'a PDF has to be split into its page images first; send it as a multipart upload';

/** One uploaded page image, as read from a multipart field or split out of a PDF. */
export interface PageUpload {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export type UploadCheck =
  | { ok: true; mimeType: string }
  | { ok: false; status: 413 | 415; message: string };

/** Where page images are stored: `CALIBRE_NOTEBOOKS_DIR`, else `notebooks/` beside the app DB. */
export function notebooksDir(): string {
  return (
    process.env.CALIBRE_NOTEBOOKS_DIR ??
    path.join(path.dirname(appDbPath()), 'notebooks')
  );
}

const extensionOf = (name: string): string =>
  path.extname(name).slice(1).toLowerCase();

/**
 * Resolves the stored MIME type of an upload. A declared image type wins; a blank or generic
 * type (as some HTTP clients send) falls back to the file extension.
 */
export function resolvePageMimeType(name: string, type: string): string | null {
  const declared = type.trim().toLowerCase();
  if (EXTENSIONS[declared]) return declared;
  if (!GENERIC_TYPES.has(declared)) return null;
  return MIME_BY_EXTENSION[extensionOf(name)] ?? null;
}

export function checkPageUpload(file: {
  name: string;
  type: string;
  size: number;
}): UploadCheck {
  const mimeType = resolvePageMimeType(file.name, file.type);
  if (!mimeType) {
    return {
      ok: false,
      status: 415,
      message: isPdf(file)
        ? `${file.name}: ${PDF_NOT_EXPANDED}`
        : `${file.name}: unsupported type; upload a JPEG, PNG, HEIC or WebP image, or a scanned PDF`,
    };
  }
  if (file.size > MAX_PAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      message: `${file.name}: larger than the 25 MB limit`,
    };
  }
  return { ok: true, mimeType };
}

type UploadRefusal = { ok: false; status: 400 | 413 | 415; message: string };

/**
 * Reads every `file` field of a multipart form. A scanned PDF becomes one JPEG upload per page,
 * in page order, in its place (see `extractPdfPages`). A request carrying any file the shelf
 * cannot store is refused whole, so a caller never has to work out which half of a batch landed.
 */
export async function readPageUploads(
  form: FormData,
): Promise<{ ok: true; uploads: PageUpload[] } | UploadRefusal> {
  const files = form
    .getAll('file')
    .filter((value): value is File => typeof value !== 'string');
  if (files.length === 0) {
    return { ok: false, status: 400, message: 'Attach at least one file' };
  }
  // Every file is checked by its size and type before any is read into memory.
  for (const file of files) {
    if (isPdf(file)) {
      if (file.size > MAX_PDF_BYTES) {
        return {
          ok: false,
          status: 413,
          message: `${file.name}: larger than the ${MAX_PDF_BYTES / 1024 / 1024} MB PDF limit`,
        };
      }
      continue;
    }
    const check = checkPageUpload(file);
    if (!check.ok) return check;
  }

  const uploads: PageUpload[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(file)) {
      uploads.push({ name: file.name, type: file.type, bytes });
      continue;
    }
    const pdf = await extractPdfPages(file.name, bytes);
    if (!pdf.ok) return pdf;
    for (const page of pdf.pages) {
      const check = checkPageUpload({ ...page, size: page.bytes.byteLength });
      if (!check.ok) return check;
      uploads.push(page);
    }
  }
  return { ok: true, uploads };
}

export const hashBytes = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const NOTEBOOK_COLUMNS = {
  id: notebooks.id,
  name: notebooks.name,
  status: notebooks.status,
  startedOn: notebooks.startedOn,
  endedOn: notebooks.endedOn,
  createdAt: notebooks.createdAt,
};

const PAGE_COLUMNS = {
  id: notebookPages.id,
  notebookId: notebookPages.notebookId,
  position: notebookPages.position,
  pageNumber: notebookPages.pageNumber,
  pageDate: notebookPages.pageDate,
  fileName: notebookPages.fileName,
  mimeType: notebookPages.mimeType,
  bytes: notebookPages.bytes,
  transcription: notebookPages.transcription,
  transcribedAt: notebookPages.transcribedAt,
  source: notebookPages.source,
  createdAt: notebookPages.createdAt,
};

export async function listNotebooks(): Promise<NotebookSummary[]> {
  return appDb
    .select({
      ...NOTEBOOK_COLUMNS,
      pageCount: count(notebookPages.id),
      coverPageId: sql<number | null>`(
        SELECT cover.id FROM notebook_pages cover
        WHERE cover.notebook_id = ${notebooks.id}
        ORDER BY cover.position LIMIT 1
      )`,
    })
    .from(notebooks)
    .leftJoin(notebookPages, eq(notebookPages.notebookId, notebooks.id))
    .groupBy(notebooks.id)
    .orderBy(
      sql`CASE ${notebooks.status} WHEN 'active' THEN 0 ELSE 1 END`,
      asc(notebooks.name),
    )
    .all();
}

function findNotebook(id: number): Notebook | null {
  return (
    appDb
      .select(NOTEBOOK_COLUMNS)
      .from(notebooks)
      .where(eq(notebooks.id, id))
      .get() ?? null
  );
}

export async function getNotebook(id: number): Promise<NotebookDetail | null> {
  const notebook = findNotebook(id);
  if (!notebook) return null;
  const pages = appDb
    .select(PAGE_COLUMNS)
    .from(notebookPages)
    .where(eq(notebookPages.notebookId, id))
    .orderBy(asc(notebookPages.position))
    .all();
  return {
    ...notebook,
    pageCount: pages.length,
    coverPageId: pages[0]?.id ?? null,
    pages,
  };
}

/** Pages of a notebook whose position is within `[from, to]`, in order, at most `limit`. */
export async function getNotebookPages(
  notebookId: number,
  { from = 1, to, limit }: { from?: number; to?: number; limit?: number } = {},
): Promise<NotebookPage[] | null> {
  if (!findNotebook(notebookId)) return null;
  const query = appDb
    .select(PAGE_COLUMNS)
    .from(notebookPages)
    .where(
      and(
        eq(notebookPages.notebookId, notebookId),
        sql`${notebookPages.position} >= ${from}`,
        to === undefined ? undefined : sql`${notebookPages.position} <= ${to}`,
      ),
    )
    .orderBy(asc(notebookPages.position));
  return limit === undefined ? query.all() : query.limit(limit).all();
}

const normalizeName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) throw new ToolInputError('Notebook name is required');
  if (trimmed.length > 120) {
    throw new ToolInputError('Notebook name is longer than 120 characters');
  }
  return trimmed;
};

export async function createNotebook(name: string): Promise<Notebook> {
  const trimmed = normalizeName(name);
  const existing = appDb
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(eq(notebooks.name, trimmed))
    .get();
  if (existing) {
    throw new ToolInputError(`A notebook named "${trimmed}" already exists`);
  }
  return appDb
    .insert(notebooks)
    .values({ name: trimmed })
    .returning(NOTEBOOK_COLUMNS)
    .get();
}

export async function findOrCreateNotebookByName(
  name: string,
): Promise<Notebook> {
  const trimmed = normalizeName(name);
  const find = () =>
    appDb
      .select(NOTEBOOK_COLUMNS)
      .from(notebooks)
      .where(eq(notebooks.name, trimmed))
      .get();
  const existing = find();
  if (existing) return existing;
  // A concurrent request may have created it since; the conflict is not an error.
  appDb.insert(notebooks).values({ name: trimmed }).onConflictDoNothing().run();
  const created = find();
  if (!created) throw new Error(`Notebook "${trimmed}" was not saved`);
  return created;
}

/**
 * Archives a finished notebook, dating its end today unless it already has one, or reopens it,
 * which clears the end date. Returns `null` for an unknown notebook.
 */
export async function setNotebookStatus(
  id: number,
  status: NotebookStatus,
): Promise<Notebook | null> {
  const notebook = findNotebook(id);
  if (!notebook) return null;
  const endedOn =
    status === 'archived'
      ? (notebook.endedOn ?? new Date().toISOString().slice(0, 10))
      : null;
  return appDb
    .update(notebooks)
    .set({ status, endedOn })
    .where(eq(notebooks.id, id))
    .returning(NOTEBOOK_COLUMNS)
    .get();
}

// The ignore comments keep Turbopack from tracing the whole project into the standalone
// output: these paths point at runtime data outside the app.
const pageFilePath = (notebookId: number, pageId: number, mimeType: string) =>
  path.join(
    /*turbopackIgnore: true*/ notebooksDir(),
    String(notebookId),
    `${pageId}.${EXTENSIONS[mimeType] ?? 'bin'}`,
  );

const DUPLICATE = 'duplicate: already in this notebook';

interface StoredPage {
  id: number;
  notebookId: number;
  notebookName: string;
  position: number;
}

const storedPageColumns = {
  id: notebookPages.id,
  notebookId: notebookPages.notebookId,
  notebookName: notebooks.name,
  position: notebookPages.position,
};

function duplicateReason(
  page: StoredPage,
  notebookId: number,
  how: string,
): string {
  return page.notebookId === notebookId
    ? DUPLICATE
    : `duplicate: ${how} page ${page.position} of "${page.notebookName}"`;
}

function findCopy(contentHash: string): StoredPage | null {
  return (
    appDb
      .select(storedPageColumns)
      .from(notebookPages)
      .innerJoin(notebooks, eq(notebooks.id, notebookPages.notebookId))
      .where(eq(notebookPages.contentHash, contentHash))
      .orderBy(asc(notebookPages.id))
      .get() ?? null
  );
}

function findLookalike(thumbnail: Uint8Array): StoredPage | null {
  const rows = appDb
    .select({ ...storedPageColumns, fingerprint: notebookPages.fingerprint })
    .from(notebookPages)
    .innerJoin(notebooks, eq(notebooks.id, notebookPages.notebookId))
    .where(isNotNull(notebookPages.fingerprint))
    .orderBy(asc(notebookPages.id))
    .all();
  for (const { fingerprint, ...page } of rows) {
    if (!fingerprint) continue;
    const stored = new Uint8Array(fingerprint);
    if (inkOf(stored) < MIN_INK) continue;
    if (pageSimilarity(thumbnail, stored) >= SAME_PAGE_SIMILARITY) return page;
  }
  return null;
}

async function backfillFingerprints(): Promise<void> {
  const rows = appDb
    .select({
      id: notebookPages.id,
      notebookId: notebookPages.notebookId,
      mimeType: notebookPages.mimeType,
    })
    .from(notebookPages)
    .where(isNull(notebookPages.fingerprint))
    .all();
  for (const row of rows) {
    try {
      const bytes = await readFile(
        pageFilePath(row.notebookId, row.id, row.mimeType),
      );
      const { thumbnail } = await fingerprintPage(new Uint8Array(bytes));
      appDb
        .update(notebookPages)
        .set({ fingerprint: Buffer.from(thumbnail) })
        .where(eq(notebookPages.id, row.id))
        .run();
    } catch {
      // A page whose file is gone or unreadable keeps no fingerprint and is never matched.
    }
  }
}

/**
 * Appends pages after the notebook's last position, in the order given, each stored as a JPEG
 * (see `normalizePageImage`). A page already stored in any notebook is skipped: the same uploaded
 * bytes, or a page that looks the same once both are shrunk to a thumbnail, which catches the
 * same scan re-encoded or re-rendered. Nearly blank pages are only matched byte for byte, since
 * every empty page looks alike. A file that is not a readable image is skipped too.
 */
export async function appendPages(
  notebookId: number,
  files: PageUpload[],
  source?: string,
): Promise<AppendPagesResult> {
  if (!findNotebook(notebookId)) {
    throw new ToolInputError(`Notebook ${notebookId} not found`);
  }
  mkdirSync(path.join(notebooksDir(), String(notebookId)), { recursive: true });
  await backfillFingerprints();

  const added: number[] = [];
  const skipped: SkippedPage[] = [];
  const isDuplicate = (db: Pick<typeof appDb, 'select'>, contentHash: string) =>
    db
      .select({ id: notebookPages.id })
      .from(notebookPages)
      .where(
        and(
          eq(notebookPages.notebookId, notebookId),
          eq(notebookPages.contentHash, contentHash),
        ),
      )
      .get() !== undefined;

  for (const file of files) {
    const check = checkPageUpload({ ...file, size: file.bytes.byteLength });
    if (!check.ok) {
      skipped.push({ name: file.name, reason: check.message });
      continue;
    }
    // Hashed as uploaded, so the same photo is recognised however it is re-encoded.
    const contentHash = hashBytes(file.bytes);
    const copy = findCopy(contentHash);
    if (copy) {
      skipped.push({
        name: file.name,
        reason: duplicateReason(copy, notebookId, 'already'),
      });
      continue;
    }
    let image: PageImage;
    try {
      image = await normalizePageImage(file.bytes, check.mimeType);
    } catch {
      skipped.push({ name: file.name, reason: 'not a readable image' });
      continue;
    }
    const { thumbnail, ink } = await fingerprintPage(image.bytes);
    const lookalike = ink >= MIN_INK ? findLookalike(thumbnail) : null;
    if (lookalike) {
      skipped.push({
        name: file.name,
        reason: duplicateReason(lookalike, notebookId, 'looks like'),
      });
      continue;
    }

    const pageId = appDb.transaction((tx) => {
      if (isDuplicate(tx, contentHash)) return null;

      const last = tx
        .select({ position: max(notebookPages.position) })
        .from(notebookPages)
        .where(eq(notebookPages.notebookId, notebookId))
        .get();
      const { id } = tx
        .insert(notebookPages)
        .values({
          notebookId,
          position: (last?.position ?? 0) + 1,
          fileName: file.name,
          mimeType: 'image/jpeg',
          bytes: image.bytes.byteLength,
          contentHash,
          fingerprint: Buffer.from(thumbnail),
          source: source?.trim() || null,
        })
        .returning({ id: notebookPages.id })
        .get();
      // Written inside the transaction: a failed write rolls the row back with it.
      writeFileSync(pageFilePath(notebookId, id, 'image/jpeg'), image.bytes);
      return id;
    });

    if (pageId === null) {
      skipped.push({ name: file.name, reason: DUPLICATE });
    } else {
      added.push(pageId);
    }
  }

  return { added, skipped };
}

function findPageFile(
  pageId: number,
): { notebookId: number; mimeType: string; fileName: string } | null {
  return (
    appDb
      .select({
        notebookId: notebookPages.notebookId,
        mimeType: notebookPages.mimeType,
        fileName: notebookPages.fileName,
      })
      .from(notebookPages)
      .where(eq(notebookPages.id, pageId))
      .get() ?? null
  );
}

/** Deletes a page and its image. Later pages keep their positions. */
export async function deletePage(pageId: number): Promise<boolean> {
  const page = findPageFile(pageId);
  if (!page) return false;
  appDb.delete(notebookPages).where(eq(notebookPages.id, pageId)).run();
  rmSync(pageFilePath(page.notebookId, pageId, page.mimeType), {
    force: true,
  });
  return true;
}

export async function setPageTranscription(
  pageId: number,
  { transcription, pageNumber, pageDate }: PageTranscriptionInput,
): Promise<NotebookPage | null> {
  return (
    appDb
      .update(notebookPages)
      .set({
        transcription,
        transcribedAt: new Date().toISOString(),
        ...(pageNumber !== undefined && { pageNumber }),
        ...(pageDate !== undefined && { pageDate }),
      })
      .where(eq(notebookPages.id, pageId))
      .returning(PAGE_COLUMNS)
      .get() ?? null
  );
}

export async function readPageFile(
  pageId: number,
): Promise<{ data: Buffer; mimeType: string; fileName: string } | null> {
  const page = findPageFile(pageId);
  if (!page) return null;
  try {
    const data = await readFile(
      /*turbopackIgnore: true*/ pageFilePath(
        page.notebookId,
        pageId,
        page.mimeType,
      ),
    );
    return { data, mimeType: page.mimeType, fileName: page.fileName };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
