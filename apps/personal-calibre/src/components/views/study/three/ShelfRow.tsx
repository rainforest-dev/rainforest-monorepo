'use client';

import { type ThreeEvent, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  type InstancedMesh,
  Matrix4,
  Object3D,
} from 'three';

import { FRONT_Z, type PlacedBook } from '@/lib';

import type { RowAtlas } from './atlas';
import { SPINE_ATTRIBUTES, type StudyKit } from './kit';
import { mixRgb, toColor, type Tokens } from './tokens';

export interface ShelfRowProps {
  books: readonly PlacedBook[];
  atlas: RowAtlas | undefined;
  kit: StudyKit;
  tokens: Tokens;
  selected: ReadonlySet<number>;
  pulledId: number | null;
  leavingId: number | null;
  highlightId: number | null;
  onPick: (bookId: number) => void;
  onHover: (hovering: boolean) => void;
}

export const SIDE_MIX = 0.45;
const PLACE = new Object3D();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

function spineGeometry(): BoxGeometry {
  const geometry = new BoxGeometry(1, 1, 1);
  const normals = geometry.getAttribute('normal');
  const front = new Float32Array(normals.count);
  for (let i = 0; i < normals.count; i++) {
    front[i] = normals.getZ(i) > 0.5 ? 1 : 0;
  }
  geometry.setAttribute(SPINE_ATTRIBUTES.spine, new BufferAttribute(front, 1));
  return geometry;
}

export function sideColor(book: PlacedBook, tokens: Tokens) {
  return toColor(
    mixRgb(tokens[`chart-${book.book.tone}`], tokens.muted, SIDE_MIX),
  );
}

export function ShelfRow({
  books,
  atlas,
  kit,
  tokens,
  selected,
  pulledId,
  leavingId,
  highlightId,
  onPick,
  onHover,
}: ShelfRowProps) {
  const invalidate = useThree((state) => state.invalidate);
  const mesh = useRef<InstancedMesh>(null);
  const geometry = useMemo(spineGeometry, []);
  const spine = useMemo(() => kit.materials.spine(), [kit]);
  const count = books.length;

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => spine.material.dispose(), [spine]);

  useEffect(() => {
    spine.setHighlight(toColor(tokens.foreground));
    spine.setSelection(toColor(tokens.primary));
    invalidate();
  }, [spine, tokens, invalidate]);

  useLayoutEffect(() => {
    const attributes = [
      [SPINE_ATTRIBUTES.rect, 4],
      [SPINE_ATTRIBUTES.side, 3],
      [SPINE_ATTRIBUTES.selected, 1],
      [SPINE_ATTRIBUTES.highlight, 1],
    ] as const;
    for (const [name, size] of attributes) {
      geometry.setAttribute(
        name,
        new InstancedBufferAttribute(new Float32Array(count * size), size),
      );
    }
  }, [geometry, count]);

  useLayoutEffect(() => {
    const sides = geometry.getAttribute(SPINE_ATTRIBUTES.side);
    books.forEach((placed, i) => {
      const color = sideColor(placed, tokens);
      sides.setXYZ(i, color.r, color.g, color.b);
    });
    sides.needsUpdate = true;
    invalidate();
  }, [books, tokens, geometry, count, invalidate]);

  useLayoutEffect(() => {
    const rects = geometry.getAttribute(SPINE_ATTRIBUTES.rect);
    books.forEach((placed, i) => {
      const [u = 0, v = 0, du = 0, dv = 0] =
        atlas?.rects.get(placed.book.id) ?? [];
      rects.setXYZW(i, u, v, du, dv);
    });
    rects.needsUpdate = true;
    spine.setAtlas(atlas?.texture ?? null);
    invalidate();
  }, [books, atlas, spine, geometry, count, invalidate]);

  useLayoutEffect(() => {
    const flags = geometry.getAttribute(SPINE_ATTRIBUTES.selected);
    books.forEach((placed, i) => {
      flags.setX(i, selected.has(placed.book.id) ? 1 : 0);
    });
    flags.needsUpdate = true;
    invalidate();
  }, [books, selected, geometry, count, invalidate]);

  useLayoutEffect(() => {
    const flags = geometry.getAttribute(SPINE_ATTRIBUTES.highlight);
    books.forEach((placed, i) => {
      flags.setX(i, placed.book.id === highlightId ? 1 : 0);
    });
    flags.needsUpdate = true;
    invalidate();
  }, [books, highlightId, geometry, count, invalidate]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    books.forEach((placed, i) => {
      if (placed.book.id === pulledId || placed.book.id === leavingId) {
        target.setMatrixAt(i, HIDDEN);
        return;
      }
      PLACE.position.set(placed.x, placed.y, FRONT_Z - placed.d / 2);
      PLACE.scale.set(placed.t, placed.h, placed.d);
      PLACE.updateMatrix();
      target.setMatrixAt(i, PLACE.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingBox();
    target.computeBoundingSphere();
    invalidate();
  }, [books, pulledId, leavingId, count, invalidate]);

  const bookAt = (event: ThreeEvent<MouseEvent>) =>
    event.instanceId === undefined ? undefined : books[event.instanceId];

  return (
    <instancedMesh
      key={count}
      ref={mesh}
      args={[geometry, spine.material, count]}
      onClick={(event) => {
        const placed = bookAt(event);
        if (!placed) return;
        event.stopPropagation();
        onPick(placed.book.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(true);
      }}
      onPointerOut={() => onHover(false)}
    />
  );
}
