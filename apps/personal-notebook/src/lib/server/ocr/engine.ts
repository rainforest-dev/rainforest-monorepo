import { assertModel, ollamaChat } from '@rainforest-dev/search/node';
import sharp from 'sharp';

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

/**
 * Ollama's default 4096-token context could not hold a phone-camera page plus the prompt: every
 * read came back HTTP 400 ("exceeds the available context size"). Pages are capped at
 * `MAX_EDGE_PX` so the image stays well under `OCR_CONTEXT` whatever the camera.
 */
export const OCR_CONTEXT = 8192;
export const MAX_EDGE_PX = 2048;

/**
 * Shrinks a page whose longer edge is past `MAX_EDGE_PX`; smaller pages pass through untouched.
 * Re-encoding drops EXIF, so the camera's orientation is applied to the pixels first.
 */
export async function fitPage(image: Uint8Array): Promise<Uint8Array> {
  const { width = 0, height = 0 } = await sharp(image).metadata();
  if (Math.max(width, height) <= MAX_EDGE_PX) return image;
  return sharp(image)
    .rotate()
    .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: 'inside' })
    .jpeg({ quality: 92 })
    .toBuffer();
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
    read: async (image, signal) =>
      ollamaChat({
        url,
        model,
        messages: [
          {
            role: 'user',
            content: OCR_PROMPT,
            images: [Buffer.from(await fitPage(image)).toString('base64')],
          },
        ],
        numCtx: OCR_CONTEXT,
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
