import { type LibraryEvent } from '@rainforest-dev/library-contract';
import { cn } from '@rainforest-dev/rainforest-react';
import {
  BabyIcon,
  CameraIcon,
  FlaskConicalIcon,
  FrameIcon,
  LandmarkIcon,
  LeafIcon,
  type LucideIcon,
  PaletteIcon,
  PenToolIcon,
  PuzzleIcon,
  SaladIcon,
  ScissorsIcon,
  StoreIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Each topic's mark on a cover drawn for an event with no picture. */
const TOPIC_COVERS: Record<string, { icon: LucideIcon; tone: string }> = {
  handmade: { icon: ScissorsIcon, tone: 'bg-chart-1/15 text-chart-1' },
  toys: { icon: PuzzleIcon, tone: 'bg-chart-4/15 text-chart-4' },
  environment: { icon: LeafIcon, tone: 'bg-success/15 text-success' },
  vegetarian: { icon: SaladIcon, tone: 'bg-success/15 text-success' },
  design: { icon: PenToolIcon, tone: 'bg-chart-3/15 text-chart-3' },
  art: { icon: PaletteIcon, tone: 'bg-chart-5/15 text-chart-5' },
  photography: { icon: CameraIcon, tone: 'bg-chart-3/15 text-chart-3' },
  science: { icon: FlaskConicalIcon, tone: 'bg-info/15 text-info' },
  history: { icon: LandmarkIcon, tone: 'bg-warning/15 text-warning' },
  kids: { icon: BabyIcon, tone: 'bg-chart-4/15 text-chart-4' },
};
const MARKET_COVER = { icon: StoreIcon, tone: 'bg-chart-2/15 text-chart-2' };
const PLAIN_COVER = { icon: FrameIcon, tone: 'bg-muted text-muted-foreground' };

function drawnCover(event: LibraryEvent) {
  if (event.kind === 'market') return MARKET_COVER;
  const topic = event.topics.find((key) => key in TOPIC_COVERS);
  return (topic && TOPIC_COVERS[topic]) || PLAIN_COVER;
}

/**
 * An event's cover: its poster when the source or its page has one, otherwise one drawn from
 * its first topic. A poster that fails to load falls back to the drawn one.
 */
export function EventCover({
  event,
  label,
}: {
  event: LibraryEvent;
  /** The kind, shown on a drawn cover. */
  label: string;
}) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A poster that failed before hydration fired its error with no listener yet.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setBroken(true);
  }, []);
  const frame = 'aspect-[4/3] w-full overflow-hidden';
  if (event.image && !broken)
    return (
      <span className={cn(frame, 'bg-muted block')} data-cover="image">
        <img
          ref={img}
          src={event.image}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      </span>
    );
  const { icon: Icon, tone } = drawnCover(event);
  return (
    <span
      className={cn(frame, tone, 'relative flex items-center justify-center')}
      data-cover="drawn"
    >
      <Icon className="size-12 opacity-80" aria-hidden />
      <span className="bg-background/90 text-foreground absolute bottom-2 left-3 rounded px-1.5 py-0.5 text-xs font-medium">
        {label}
      </span>
    </span>
  );
}
