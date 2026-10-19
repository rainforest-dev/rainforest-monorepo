import { type HallLayout, type Slot, slotOf } from './layout';
import type { Bookcase } from './model';

/** Where every book stands for one arrangement of bookcases. */
export function placeBooks(
  cases: readonly Bookcase[],
  layout: HallLayout,
): Map<number, Slot> {
  const slots = new Map<number, Slot>();
  cases.forEach((bookcase, i) => {
    const placement = layout.cases[i];
    if (!placement) return;
    bookcase.bookIds.forEach((id, index) =>
      slots.set(id, slotOf(placement, index, id)),
    );
  });
  return slots;
}

/** The whole re-sort, start of the first flight to the landing of the last. */
export const RESORT_MS = 2200;
/** Share of the re-sort over which take-offs are spread; the rest is one book's flight. */
const STAGGER = 0.45;

/** 0 before the book leaves, 1 once it has landed. `order` is in [0, 1). */
export function flightProgress(elapsedMs: number, order: number): number {
  const start = order * STAGGER;
  const t = (elapsedMs / RESORT_MS - start) / (1 - STAGGER);
  return Math.min(1, Math.max(0, t));
}

const ease = (t: number) => t * t * (3 - 2 * t);

export interface FlightPose {
  x: number;
  y: number;
  z: number;
  /** Turns about the vertical axis, so books tumble rather than slide. */
  spin: number;
  /** 0–1; books past a case's capacity fade in or out instead of flying. */
  scale: number;
}

/** A book on its way from one slot to another: up, across on an arc, and down onto the shelf. */
export function flightPose(from: Slot, to: Slot, t: number): FlightPose {
  const k = ease(t);
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const lift = 0.9 + distance * 0.18;
  const arc = 4 * k * (1 - k) * lift;
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k + arc,
    z: from.z + (to.z - from.z) * k + arc * 0.25,
    spin: distance < 0.01 ? 0 : k,
    scale: (from.visible ? 1 - k : 0) + (to.visible ? k : 0),
  };
}

/**
 * A stable shuffle of take-off order, so neighbouring books do not leave in a line.
 * Golden-ratio steps spread ids evenly over [0, 1).
 */
export function takeoffOrder(id: number): number {
  return (id * 0.618033988749895) % 1;
}
