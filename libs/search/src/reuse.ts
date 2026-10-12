export type Keyed = { id: string; hash: string };
export type Reusable = Keyed & { retry?: boolean | undefined };

export function planReuse(
  previous: readonly Reusable[],
  current: readonly Keyed[],
): { reuse: Map<number, number>; missing: number[] } {
  const rowOf = new Map(
    previous.flatMap((p, i) =>
      p.retry ? [] : [[`${p.id}\u0000${p.hash}`, i] as const],
    ),
  );
  const reuse = new Map<number, number>();
  const missing: number[] = [];
  current.forEach((c, i) => {
    const row = rowOf.get(`${c.id}\u0000${c.hash}`);
    if (row === undefined) missing.push(i);
    else reuse.set(i, row);
  });
  return { reuse, missing };
}
