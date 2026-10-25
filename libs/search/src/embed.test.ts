import { describe, expect, it, vi } from 'vitest';

import {
  breaker,
  type Embedder,
  EmbedError,
  embedQuery,
  withQueryPriority,
} from './embed';

const embedder = (embed: Embedder['embed'], dims = 2): Embedder => ({
  model: 'm',
  dims,
  minScore: 0,
  images: false,
  embed,
});

const unit = embedder(async (texts) => texts.map(() => Float32Array.of(1, 0)));

describe('embedQuery', () => {
  it('returns a valid vector', async () => {
    const v = await embedQuery(
      embedder(async () => [Float32Array.from([1, 0])]),
      'q',
    );
    expect(Array.from(v)).toEqual([1, 0]);
  });

  it('rejects a wrong-length or non-finite vector as a model mismatch', async () => {
    await expect(
      embedQuery(
        embedder(async () => [Float32Array.from([1])]),
        'q',
      ),
    ).rejects.toMatchObject({ reason: 'model-mismatch' });
    await expect(
      embedQuery(
        embedder(async () => [Float32Array.from([NaN, 1])]),
        'q',
      ),
    ).rejects.toMatchObject({ reason: 'model-mismatch' });
  });

  it('times out, but lets the call run on so a cold model can load', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = embedQuery(
      embedder((_t, _k, s) => {
        signal = s;
        return new Promise(() => undefined);
      }),
      'q',
      100,
      1000,
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(EmbedError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(900);
    expect(signal?.aborted).toBe(true);
    vi.useRealTimers();
  });

  it('never aborts a call that finished after the timeout', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const pending = embedQuery(
      embedder(
        (_t, _k, s) =>
          new Promise((resolve) => {
            signal = s;
            setTimeout(() => resolve([Float32Array.of(1, 0)]), 300);
          }),
      ),
      'q',
      100,
      1000,
    );
    const assertion = expect(pending).rejects.toMatchObject({
      reason: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(2000);
    await assertion;
    expect(signal?.aborted).toBe(false);
    vi.useRealTimers();
  });

  it('times out after 800 ms by default', async () => {
    vi.useFakeTimers();
    let settled = false;
    const pending = embedQuery(
      embedder(() => new Promise(() => undefined)),
      'q',
    ).catch((error: unknown) => {
      settled = true;
      return error;
    });
    await vi.advanceTimersByTimeAsync(799);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ reason: 'timeout' });
    vi.useRealTimers();
  });
});

describe('breaker', () => {
  it('stays open for its window after a trip', () => {
    const gate = breaker(1000);
    expect(gate.open(0)).toBe(false);
    gate.trip(0);
    expect(gate.open(999)).toBe(true);
    expect(gate.open(1000)).toBe(false);
  });

  it('skips the embedder for 30 s by default', () => {
    const gate = breaker();
    gate.trip(0);
    expect(gate.open(29_999)).toBe(true);
    expect(gate.open(30_000)).toBe(false);
  });
});

describe('withQueryPriority', () => {
  it('holds background embeds while a query embed is in flight', async () => {
    let finishQuery: () => void = () => undefined;
    const order: string[] = [];
    const { foreground, background } = withQueryPriority({
      ...unit,
      embed: async (texts, kind) => {
        order.push(`start ${kind}`);
        if (kind === 'query') await new Promise<void>((r) => (finishQuery = r));
        order.push(`end ${kind}`);
        return unit.embed(texts, kind);
      },
    });
    const query = foreground.embed(['拉麵'], 'query');
    const note = background.embed(['海邊'], 'document');
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['start query']);
    finishQuery();
    await Promise.all([query, note]);
    expect(order).toEqual([
      'start query',
      'end query',
      'start document',
      'end document',
    ]);
  });

  it('releases background embeds when a query embed fails', async () => {
    const { foreground, background } = withQueryPriority({
      ...unit,
      embed: async (texts, kind) => {
        if (kind === 'query') throw new Error('timeout');
        return unit.embed(texts, kind);
      },
    });
    await expect(foreground.embed(['x'], 'query')).rejects.toThrow('timeout');
    await expect(background.embed(['海邊'], 'document')).resolves.toHaveLength(
      1,
    );
  });
});
