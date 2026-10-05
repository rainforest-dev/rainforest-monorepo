'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  MathUtils,
  type Mesh,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';

import { FRONT_Z, type PlacedBook } from '@/lib';

import { cropSpine, type RowAtlas } from './atlas';
import type { CoverCache } from './covers';
import type { StudyKit } from './kit';
import { sideColor } from './ShelfRow';
import { toColor, type Tokens } from './tokens';

export interface PulledBookProps {
  book: PlacedBook | null;
  atlas: RowAtlas | undefined;
  width: number;
  kit: StudyKit;
  tokens: Tokens;
  covers: CoverCache;
  meshRef: RefObject<Mesh | null>;
  onPick: (bookId: number) => void;
  onHover: (hovering: boolean) => void;
}

const PULL_RATE = 4;
const PULL_TURN = (-Math.PI / 2) * 0.78;
const SPINE_PX = 4;

function spineTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SPINE_PX;
  canvas.height = SPINE_PX;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function PulledBook({
  book,
  atlas,
  width,
  kit,
  tokens,
  covers,
  meshRef,
  onPick,
  onHover,
}: PulledBookProps) {
  const invalidate = useThree((state) => state.invalidate);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const pulled = useMemo(() => kit.materials.pulledBook(), [kit]);
  const spine = useMemo(spineTexture, []);
  const progress = useRef(1);
  const home = useMemo(() => new Vector3(), []);
  const out = useMemo(() => new Vector3(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => pulled.material.dispose(), [pulled]);
  useEffect(() => () => spine.dispose(), [spine]);

  const bookId = book?.book.id ?? null;
  const cropped = useMemo(
    () => (atlas && bookId !== null ? cropSpine(atlas, bookId) : null),
    [atlas, bookId],
  );
  useEffect(() => () => cropped?.dispose(), [cropped]);

  const [cover, setCover] = useState<{
    id: number;
    covers: CoverCache;
    texture: Texture;
  } | null>(null);
  useEffect(() => {
    if (!book) return;
    const id = book.book.id;
    const hit = covers.get(id);
    if (hit) {
      setCover({ id, covers, texture: hit });
      return;
    }
    let live = true;
    covers.ensure(book.book).then(
      (texture) => {
        if (live) setCover({ id, covers, texture });
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [book, covers]);
  const coverTexture =
    cover && cover.id === bookId && cover.covers === covers
      ? cover.texture
      : null;

  useLayoutEffect(() => {
    if (!book) return;
    const side = sideColor(book, tokens);
    if (!cropped) {
      const ctx = spine.image.getContext('2d');
      if (ctx) {
        ctx.fillStyle = `#${side.getHexString(SRGBColorSpace)}`;
        ctx.fillRect(0, 0, SPINE_PX, SPINE_PX);
      }
      spine.needsUpdate = true;
    }
    pulled.point({
      cover: coverTexture,
      spine: cropped ?? spine,
      side,
      pages: toColor(tokens.card),
    });
    invalidate();
  }, [book, tokens, spine, cropped, coverTexture, pulled, invalidate]);

  useLayoutEffect(() => {
    if (!book) return;
    home.set(book.x, book.y, FRONT_Z - book.d / 2);
    out.set(
      MathUtils.clamp(book.x, book.d * 0.45, width - book.d * 0.45),
      book.y + 0.12,
      FRONT_Z + book.t + 0.35,
    );
    invalidate();
  }, [book, width, home, out, invalidate]);

  useLayoutEffect(() => {
    progress.current = 0;
    const mesh = meshRef.current;
    if (mesh) {
      mesh.position.copy(home);
      mesh.rotation.y = 0;
    }
    invalidate();
  }, [bookId, meshRef, home, invalidate]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !book) return;
    progress.current = Math.min(1, progress.current + delta * PULL_RATE);
    const eased = 1 - (1 - progress.current) ** 3;
    mesh.position.lerpVectors(home, out, eased);
    mesh.rotation.y = PULL_TURN * eased;
    if (progress.current < 1) invalidate();
  });

  return (
    <mesh
      ref={meshRef}
      frustumCulled={false}
      geometry={geometry}
      material={pulled.material}
      scale={book ? [book.t, book.h, book.d] : 0}
      onClick={(event) => {
        if (!book) return;
        event.stopPropagation();
        onPick(book.book.id);
      }}
      onPointerOver={(event) => {
        if (!book) return;
        event.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    />
  );
}
