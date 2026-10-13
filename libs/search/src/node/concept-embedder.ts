import type { Embedder } from '../embed';

export function conceptEmbedder(
  concepts: readonly (readonly string[])[],
  model = 'fake',
): Embedder {
  return {
    model,
    dims: concepts.length,
    minScore: 0.01,
    images: true,
    async embed(texts) {
      return texts.map((item) => {
        const text = typeof item === 'string' ? item : item.text;
        const folded = text.normalize('NFKC').toLowerCase();
        return Float32Array.from(
          concepts.map((words) =>
            words.some((w) => folded.includes(w)) ? 1 : 0,
          ),
        );
      });
    },
  };
}
