/**
 * Starts the notebook OCR worker when the server boots, if OCR is configured. Node only: the
 * worker reads page files and SQLite.
 */
export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return;
  const { ocrEngineFromEnv, startOcrWorker } = await import('@/lib/server/ocr');
  const engine = ocrEngineFromEnv();
  if (!engine) return;
  const interval = Number(process.env['CALIBRE_OCR_INTERVAL_MS']);
  startOcrWorker(engine, {
    ...(interval > 0 ? { intervalMs: interval } : {}),
  });
}
