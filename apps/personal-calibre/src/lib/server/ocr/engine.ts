import { assertModel, ollamaChat } from '@rainforest-dev/search/node';

import { OCR_PROMPT } from './prompt';

type Env = Record<string, string | undefined>;

/** Reads one page image and returns the model's raw answer to `OCR_PROMPT`. */
export interface OcrEngine {
  /** Stored as `ocr:<name>` beside each transcription it writes. */
  name: string;
  /** Throws when the engine cannot run at all, so no page is charged an attempt for it. */
  ready(): Promise<void>;
  read(image: Uint8Array, signal: AbortSignal): Promise<string>;
}

export function ollamaOcr({
  url,
  model,
  fetch: fetchImpl = fetch,
}: {
  url: string;
  model: string;
  fetch?: typeof fetch;
}): OcrEngine {
  return {
    name: model,
    ready: () => assertModel(url, model, fetchImpl),
    read: (image, signal) =>
      ollamaChat({
        url,
        model,
        messages: [
          {
            role: 'user',
            content: OCR_PROMPT,
            images: [Buffer.from(image).toString('base64')],
          },
        ],
        signal,
        fetch: fetchImpl,
      }),
  };
}

/** A stand-in for tests: every page reads as an undated collection page. */
export const fakeOcr: OcrEngine = {
  name: 'fake',
  ready: async () => undefined,
  read: async (image) =>
    `DATE: none\nPAGE: none\nHEADINGS: Scanned page\nTEXT:\n• ${image.byteLength} bytes`,
};

/**
 * OCR runs only when configured: `CALIBRE_OCR_MODEL` names a vision model on the Ollama at
 * `CALIBRE_OLLAMA_URL`, or `CALIBRE_OCR=fake` for tests. Unset, pages wait for a person or agent.
 */
export function ocrEngineFromEnv(
  env: Env = process.env,
): OcrEngine | undefined {
  if (env['CALIBRE_OCR'] === 'fake') return fakeOcr;
  const url = env['CALIBRE_OLLAMA_URL'];
  const model = env['CALIBRE_OCR_MODEL'];
  return url && model ? ollamaOcr({ url, model }) : undefined;
}
