'use client';

import {
  EVENTS_PAGE_HREF,
  getCollection,
} from '@rainforest-dev/library-contract';
import { useLibraryLocale, useLibraryT } from '@rainforest-dev/library-shell';
import { Button } from '@rainforest-dev/rainforest-react';
import { Box } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { canUseWebGL2 } from '@/components/study/capabilities';
import {
  useHallRack,
  useHallTime,
  useHallWeather,
  useIsPhone,
  useReducedMotion,
} from '@/hooks';
import {
  buildWings,
  cn,
  frameFor,
  HALL_GROUP_BYS,
  layoutHall,
  papersOf,
} from '@/lib';
import { HALL_NAMESPACE } from '@/locales';
import { useHall } from '@/providers';

import { CssHall } from './CssHall';
import { HallBoundary } from './HallBoundary';
import { HallConditions } from './HallConditions';
import { HallSkeleton } from './HallSkeleton';
import { readHallMemory } from './memory';
import { LoadThreeHall } from './three/loadThreeHall';

const PHONE_3D_KEY = 'library-hall-phone-3d';

function phoneOptedIn(): boolean {
  try {
    return sessionStorage.getItem(PHONE_3D_KEY) === '1';
  } catch {
    return false;
  }
}

export function HallView() {
  const { books, cases, wings, enterBookcase, hallReturn, studyFallback } =
    useHall();
  const reducedMotion = useReducedMotion();
  const now = useHallTime();
  const weather = useHallWeather();
  const rack = useHallRack();
  const papers = useMemo(() => papersOf(books), [books]);
  const locale = useLibraryLocale();
  const t = useLibraryT(HALL_NAMESPACE);
  const phone = useIsPhone();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [phone3d, setPhone3d] = useState(false);
  useEffect(() => {
    setWebgl(!studyFallback && canUseWebGL2());
    setPhone3d(phoneOptedIn());
  }, [studyFallback]);
  // Phones start on the bookcase list and load 3D only when asked: it costs battery and memory.
  const three = webgl === null ? null : webgl && (!phone || phone3d);

  // The room fits the grouping that needs the most bookcases, so its walls stay put; the
  // bookcases inside rise and sink as a new grouping needs more or fewer.
  const frame = useMemo(
    () =>
      frameFor(
        HALL_GROUP_BYS.map((g) =>
          buildWings(books, g, locale).map((w) => w.cases.length),
        ),
      ),
    [books, locale],
  );
  const layout = useMemo(
    () =>
      layoutHall(
        wings.map((w) => w.cases.length),
        frame,
      ),
    [wings, frame],
  );
  // Read once per mount: a reload or a non-bfcache Back resumes where the reader stood.
  const [memory] = useState(() =>
    typeof window === 'undefined' ? null : readHallMemory(),
  );
  const resume = hallReturn ? null : memory;
  const [poster, setPoster] = useState<'shown' | 'fading' | 'gone'>(
    resume?.poster ? 'shown' : 'gone',
  );
  const onFirstFrame = useCallback(
    () =>
      setPoster((state) =>
        state !== 'shown' ? state : reducedMotion ? 'gone' : 'fading',
      ),
    [reducedMotion],
  );

  return (
    <div
      data-hall
      data-hall-mode={three === null ? undefined : three ? '3d' : 'css'}
    >
      {three === null || now === null ? (
        <HallSkeleton />
      ) : three ? (
        <HallBoundary
          fallback={
            <CssHall wings={wings} onEnter={enterBookcase} rack={rack} />
          }
        >
          <CssHall wings={wings} onEnter={enterBookcase} rack={rack} hidden />
          <div className="relative">
            <LoadThreeHall
              books={books}
              cases={cases}
              wings={wings}
              layout={layout}
              startKey={hallReturn?.key ?? null}
              memory={resume}
              reducedMotion={reducedMotion}
              now={now}
              weather={weather}
              rack={rack}
              papers={papers}
              onEnter={enterBookcase}
              onRack={() => window.location.assign(EVENTS_PAGE_HREF)}
              onPapers={() =>
                window.location.assign(getCollection('rack').basePath)
              }
              onFirstFrame={onFirstFrame}
            />
            {resume?.poster && poster !== 'gone' && (
              // The last frame from before the page was rebuilt, over the skeleton and the
              // starting scene, until the live scene has drawn its first frame.
              <img
                src={resume.poster}
                alt=""
                aria-hidden
                data-hall-poster={poster}
                onTransitionEnd={() => setPoster('gone')}
                className={cn(
                  'pointer-events-none absolute inset-0 size-full rounded-lg object-cover transition-opacity duration-200',
                  poster === 'fading' && 'opacity-0',
                )}
              />
            )}
            <HallConditions
              now={now}
              weather={weather}
              className="pointer-events-none absolute left-2 top-2"
            />
          </div>
        </HallBoundary>
      ) : (
        <div className="flex flex-col gap-3">
          <HallConditions now={now} weather={weather} />
          {webgl && (
            <Button
              size="lg"
              data-hall-enter-3d
              onClick={() => {
                try {
                  sessionStorage.setItem(PHONE_3D_KEY, '1');
                } catch {
                  // Blocked storage only means asking again next visit.
                }
                setPhone3d(true);
              }}
            >
              <Box aria-hidden />
              {t('hall.enter3d')}
            </Button>
          )}
          {webgl && (
            <p className="text-muted-foreground -mt-1 text-xs">
              {t('hall.phone3dHint')}
            </p>
          )}
          <CssHall wings={wings} onEnter={enterBookcase} rack={rack} />
        </div>
      )}
    </div>
  );
}
