'use client';

import { Button } from '@rainforest-dev/rainforest-react';
import { Box } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { canUseWebGL2 } from '@/components/study/capabilities';
import { useIsPhone, useReducedMotion } from '@/hooks';
import { buildHall, cn, HALL_GROUP_BYS, layoutHall } from '@/lib';
import { useHall } from '@/providers';

import { CssHall } from './CssHall';
import { HallBoundary } from './HallBoundary';
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
  const { books, cases, enterBookcase, hallReturn, studyFallback } = useHall();
  const reducedMotion = useReducedMotion();
  const phone = useIsPhone();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [phone3d, setPhone3d] = useState(false);
  useEffect(() => {
    setWebgl(!studyFallback && canUseWebGL2());
    setPhone3d(phoneOptedIn());
  }, [studyFallback]);
  // Phones start on the bookcase list and load 3D only when asked: it costs battery and memory.
  const three = webgl === null ? null : webgl && (!phone || phone3d);

  // Sized for the grouping with the most bookcases, so switching grouping moves books, not furniture.
  const layout = useMemo(
    () =>
      layoutHall(
        Math.max(...HALL_GROUP_BYS.map((g) => buildHall(books, g).length)),
      ),
    [books],
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
      {three === null ? (
        <HallSkeleton />
      ) : three ? (
        <HallBoundary
          fallback={<CssHall cases={cases} onEnter={enterBookcase} />}
        >
          <CssHall cases={cases} onEnter={enterBookcase} hidden />
          <div className="relative">
            <LoadThreeHall
              books={books}
              cases={cases}
              layout={layout}
              startKey={hallReturn?.key ?? null}
              memory={resume}
              reducedMotion={reducedMotion}
              onEnter={enterBookcase}
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
          </div>
        </HallBoundary>
      ) : (
        <div className="flex flex-col gap-3">
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
              進入 3D 大廳
            </Button>
          )}
          {webgl && (
            <p className="text-muted-foreground -mt-1 text-xs">
              手機預設不載入 3D，省電也省記憶體。進去之後點地板走路。
            </p>
          )}
          <CssHall cases={cases} onEnter={enterBookcase} />
        </div>
      )}
    </div>
  );
}
