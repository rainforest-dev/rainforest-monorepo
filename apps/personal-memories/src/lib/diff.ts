export type DiffLine = { text: string; changed: boolean };
export type LineDiff = { a: DiffLine[]; b: DiffLine[] };

function splitLines(text: string): string[] {
  return text === '' ? [] : text.split('\n');
}

export function lineDiff(a: string, b: string): LineDiff {
  const linesA = splitLines(a);
  const linesB = splitLines(b);
  const n = linesA.length;
  const m = linesB.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        linesA[i] === linesB[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const outA: DiffLine[] = [];
  const outB: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (linesA[i] === linesB[j]) {
      outA.push({ text: linesA[i], changed: false });
      outB.push({ text: linesB[j], changed: false });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      outA.push({ text: linesA[i], changed: true });
      i++;
    } else {
      outB.push({ text: linesB[j], changed: true });
      j++;
    }
  }
  while (i < n) {
    outA.push({ text: linesA[i], changed: true });
    i++;
  }
  while (j < m) {
    outB.push({ text: linesB[j], changed: true });
    j++;
  }
  return { a: outA, b: outB };
}
