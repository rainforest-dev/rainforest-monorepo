/** A box on screen in CSS pixels, from its top-left corner. */
export interface ScreenBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

/**
 * The top a box takes so it clears every box in `nearer`, moving only up. A wing's sign in a far
 * row projects onto the name plates of the rows in front of it, and up is where farther things
 * are drawn, so the sign still reads as standing behind them.
 */
export function liftClear(
  box: ScreenBox,
  nearer: readonly ScreenBox[],
  gap = 2,
): number {
  let y = box.y;
  // Each lift can only land on a plate higher up, so this ends within one pass per plate.
  for (let pass = 0; pass <= nearer.length; pass++) {
    const hit = nearer.find((n) => overlaps({ ...box, y }, n));
    if (!hit) break;
    y = hit.y - box.h - gap;
  }
  return y;
}
