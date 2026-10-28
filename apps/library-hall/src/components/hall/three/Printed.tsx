'use client';

import { type ThreeEvent, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

import { RACK_TIER_TOKEN } from '@/components/hall/RackCard';
import { mixRgb, type Rgb, type Tokens } from '@/components/study/three/tokens';
import {
  type HallLayout,
  type HallPapers,
  type HallRack,
  PAPER,
  PAPERS_PER_ROW,
  paperSlot,
  RACK_COVER,
  RACK_COVERS_PER_TIER,
  rackCoverSlot,
} from '@/lib';

import { COVER_PX, drawCover, drawPaper, PAPER_PX } from './print';

/** Covers lean back against the rack, top away from the reader. */
const COVER_LEAN = -0.2;
/** Papers hang a little off the vertical, their foot toward the reader. */
const PAPER_HANG = 0.06;

type Click = (e: ThreeEvent<MouseEvent>) => void;

/**
 * A thin board with `draw` printed on it. `draw` runs at once with no picture, again once the
 * web fonts are in, and again with the picture when `image` loads; a picture that fails keeps
 * the drawn face.
 */
function PrintedBoard({
  px,
  size,
  position,
  tilt,
  draw,
  image,
  onClick,
}: {
  px: { w: number; h: number };
  size: { w: number; h: number };
  position: { x: number; y: number; z: number };
  tilt: number;
  draw: (ctx: CanvasRenderingContext2D, image: HTMLImageElement | null) => void;
  image?: string;
  onClick: Click;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = px.w;
    canvas.height = px.h;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [px.w, px.h]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext('2d');
    if (!ctx) return;
    let live = true;
    let picture: HTMLImageElement | null = null;
    const paint = () => {
      if (!live) return;
      draw(ctx, picture);
      texture.needsUpdate = true;
      invalidate();
    };
    paint();
    document.fonts?.ready.then(paint, () => undefined);
    if (!image) return () => void (live = false);
    const loading = new Image();
    loading.decoding = 'async';
    loading.onload = () => {
      picture = loading;
      paint();
    };
    loading.src = image;
    return () => {
      live = false;
      loading.onload = null;
    };
  }, [texture, draw, image, invalidate]);
  return (
    <mesh
      position={[position.x, position.y, position.z]}
      rotation-x={tilt}
      castShadow
      onClick={onClick}
    >
      <boxGeometry args={[size.w, size.h, 0.012]} />
      <meshStandardMaterial map={texture} roughness={0.7} />
    </mesh>
  );
}

function Cover({
  title,
  tint,
  image,
  at,
  onClick,
}: {
  title: string;
  tint: Rgb;
  image?: string;
  at: { x: number; y: number; z: number };
  onClick: Click;
}) {
  const [r, g, b] = tint;
  const draw = useMemo(
    () => (ctx: CanvasRenderingContext2D, picture: HTMLImageElement | null) =>
      drawCover(ctx, title, [r, g, b], picture),
    [title, r, g, b],
  );
  return (
    <PrintedBoard
      px={COVER_PX}
      size={RACK_COVER}
      position={at}
      tilt={COVER_LEAN}
      draw={draw}
      image={image}
      onClick={onClick}
    />
  );
}

/** The magazine rack's covers: the first few events of each tier, face out. */
export function RackCovers({
  rack,
  layout,
  tokens,
  onClick,
}: {
  rack: HallRack | null;
  layout: HallLayout;
  tokens: Tokens;
  onClick: Click;
}) {
  return (
    <>
      {rack?.tiers.flatMap((row, tier) => {
        const base = tokens[RACK_TIER_TOKEN[row.shelf]];
        return row.covers
          .slice(0, RACK_COVERS_PER_TIER)
          .map((cover, k) => (
            <Cover
              key={cover.id}
              title={cover.title}
              tint={mixRgb(base, tokens.card, 0.9 - k * 0.12)}
              image={cover.image}
              at={rackCoverSlot(layout.rack, tier, k)}
              onClick={onClick}
            />
          ));
      })}
    </>
  );
}

function Paper({
  masthead,
  headline,
  image,
  at,
  onClick,
}: {
  masthead: string | null;
  headline: string;
  image?: string;
  at: { x: number; y: number; z: number };
  onClick: Click;
}) {
  const draw = useMemo(
    () => (ctx: CanvasRenderingContext2D, picture: HTMLImageElement | null) =>
      drawPaper(ctx, masthead, headline, picture),
    [masthead, headline],
  );
  return (
    <PrintedBoard
      px={PAPER_PX}
      size={PAPER}
      position={at}
      tilt={PAPER_HANG}
      draw={draw}
      image={image}
      onClick={onClick}
    />
  );
}

/** The newspaper stand's papers: the first articles of the reading queue, over its rods. */
export function StandPapers({
  papers,
  layout,
  onClick,
}: {
  papers: HallPapers;
  layout: HallLayout;
  onClick: Click;
}) {
  return (
    <>
      {papers.papers.map((paper, i) => (
        <Paper
          key={paper.key}
          masthead={paper.masthead}
          headline={paper.headline}
          image={paper.image}
          at={paperSlot(
            layout.papers,
            Math.floor(i / PAPERS_PER_ROW),
            i % PAPERS_PER_ROW,
          )}
          onClick={onClick}
        />
      ))}
    </>
  );
}
