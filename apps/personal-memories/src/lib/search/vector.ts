export function topK(
  vectors: Float32Array,
  dims: number,
  query: Float32Array,
  k: number,
  allow: (row: number) => boolean = () => true,
): { row: number; score: number }[] {
  let qn = 0;
  for (let d = 0; d < dims; d++) qn += (query[d] ?? 0) ** 2;
  if (qn === 0) return [];
  const out: { row: number; score: number }[] = [];
  const count = Math.floor(vectors.length / dims);
  for (let row = 0; row < count; row++) {
    if (!allow(row)) continue;
    let dot = 0;
    let rn = 0;
    for (let d = 0; d < dims; d++) {
      const v = vectors[row * dims + d] ?? 0;
      dot += v * (query[d] ?? 0);
      rn += v * v;
    }
    if (rn === 0) continue;
    out.push({ row, score: dot / Math.sqrt(qn * rn) });
  }
  return out.sort((a, b) => b.score - a.score || a.row - b.row).slice(0, k);
}
