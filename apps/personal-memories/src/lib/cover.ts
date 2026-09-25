import type { PhotoSignals, TimelineEvent } from './timeline.ts';

export const isCoverCandidate = (e: TimelineEvent) =>
  e.source === 'photo' && !!e.media?.length && !e.photo?.movie;

export function scoreCover(photo: PhotoSignals | undefined): number {
  if (!photo) return 0.5;
  return (
    (photo.score ?? 0.5) +
    (photo.people > 0 ? 0.15 : 0) -
    (photo.screenshot ? 0.6 : 0) -
    (photo.burstPick ? 0 : 0.4)
  );
}

export type CoverPick = { id: string; manual: boolean };

export function pickCover(
  events: readonly TimelineEvent[],
  override?: string,
): CoverPick | undefined {
  const candidates = events.filter(isCoverCandidate);
  if (override && candidates.some((e) => e.id === override))
    return { id: override, manual: true };
  let best: TimelineEvent | undefined;
  let bestTier = -1;
  let bestScore = -Infinity;
  for (const e of candidates) {
    const tier = e.photo?.favorite ? 1 : 0;
    const score = scoreCover(e.photo);
    if (tier > bestTier || (tier === bestTier && score > bestScore)) {
      best = e;
      bestTier = tier;
      bestScore = score;
    }
  }
  return best && { id: best.id, manual: false };
}

export const toggleCover = (current: string | undefined, id: string) =>
  current === id ? undefined : id;
