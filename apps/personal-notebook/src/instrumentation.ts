/**
 * On server boot: opens the DB, which runs the one-time import from personal-calibre when
 * `NOTEBOOK_IMPORT_FROM` is set, then starts the OCR worker if OCR is configured. Node only: both
 * read page files and SQLite.
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  if (process.env['NOTEBOOK_DATA_DIR']) {
    const { openDb } = await import('@/db');
    openDb();
  }
  const { ocrEngineFromEnv, startOcrWorker } = await import('@/lib/server/ocr');
  const engine = ocrEngineFromEnv();
  if (!engine) return;
  const interval = Number(process.env['NOTEBOOK_OCR_INTERVAL_MS']);
  startOcrWorker(engine, {
    ...(interval > 0 ? { intervalMs: interval } : {}),
  });
}
