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
  Euler,
  Mesh,
  Quaternion,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';

import type { InspectStage } from '@/components/views/study/useStudyInspect';
import {
  approach,
  floatCentre,
  floatHeightPx,
  FRONT_Z,
  inspectHeightPx,
  type PlacedBook,
  pxPerUnitAt,
} from '@/lib';

import { cropSpine, type RowAtlas } from './atlas';
import type { CoverCache } from './covers';
import type { StudyKit } from './kit';
import { sideColor } from './ShelfRow';
import { toColor, type Tokens } from './tokens';

export type CarrierMode = 'pull' | 'float' | 'inspect' | 'home';

export interface ScrubPointer {
  x: number;
  y: number;
  invalidate: () => void;
}

export interface PulledBookProps {
  book: PlacedBook | null;
  mode: CarrierMode;
  instant: boolean;
  pointer: RefObject<ScrubPointer>;
  stage: RefObject<InspectStage>;
  back: Texture | null;
  pxPerUnit: number;
  onHome: (bookId: number) => void;
  atlas: RowAtlas | undefined;
  kit: StudyKit;
  tokens: Tokens;
  covers: CoverCache;
  meshRef: RefObject<Mesh | null>;
  onPick: (bookId: number) => void;
  onHover: (hovering: boolean) => void;
}

const POSE_RATE = 14;
const PULL_DEPTH = 0.5;
const PULL_LIFT = 0.12;
const FLOAT_Z = 1.6;
const FLOAT_TURN = -Math.PI / 2 + 0.32;
const FLOAT_TILT = -0.06;
const INSPECT_Z = 3;
const AIM = new Euler();
const AIMED = new Quaternion();
const SETTLED = 1e-4;
const SPINE_PX = 4;
const NO_HIT = () => undefined;
const UPRIGHT = new Quaternion();
const FLOATING = new Quaternion().setFromEuler(
  new Euler(FLOAT_TILT, FLOAT_TURN, 0),
);

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
  mode,
  instant,
  pointer,
  stage,
  back,
  pxPerUnit,
  onHome,
  atlas,
  kit,
  tokens,
  covers,
  meshRef,
  onPick,
  onHover,
}: PulledBookProps) {
  const invalidate = useThree((state) => state.invalidate);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const pulled = useMemo(() => kit.materials.pulledBook(), [kit]);
  const spine = useMemo(spineTexture, []);
  const home = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const ray = useMemo(() => new Vector3(), []);
  const grow = useRef(1);
  const arrived = useRef<number | null>(null);

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
      back,
      spine: cropped ?? spine,
      side,
      pages: toColor(tokens.card),
    });
    invalidate();
  }, [book, tokens, spine, cropped, coverTexture, back, pulled, invalidate]);

  useLayoutEffect(() => {
    if (!book) return;
    home.set(book.x, book.y, FRONT_Z - book.d / 2);
    invalidate();
  }, [book, home, invalidate]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    grow.current = 1;
    arrived.current = null;
    if (!mesh) return;
    mesh.position.copy(home);
    mesh.quaternion.identity();
    if (book) mesh.scale.set(book.t, book.h, book.d);
    else mesh.scale.setScalar(0);
    invalidate();
  }, [bookId, meshRef, home, invalidate]);

  useLayoutEffect(() => {
    arrived.current = null;
    invalidate();
  }, [mode, invalidate]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !book) return;
    let turn = UPRIGHT;
    let scale = 1;
    if (mode === 'home') {
      target.copy(home);
    } else if (mode === 'pull') {
      target
        .set(book.x, book.y + book.h / 2, FRONT_Z)
        .sub(camera.position)
        .setLength(-PULL_DEPTH)
        .add(home);
      target.y += PULL_LIFT;
    } else {
      const inspecting = mode === 'inspect';
      const z = FRONT_Z + (inspecting ? INSPECT_Z : FLOAT_Z);
      const heightPx = inspecting
        ? inspectHeightPx(size, book.d / book.h)
        : floatHeightPx(size);
      scale =
        heightPx / (book.h * pxPerUnitAt(pxPerUnit, camera.position.z, z));
      const centre = inspecting
        ? { x: size.width / 2, y: size.height / 2 }
        : floatCentre(
            pointer.current,
            { width: (heightPx * book.d) / book.h, height: heightPx },
            size,
          );
      ray
        .set(
          (centre.x / size.width) * 2 - 1,
          1 - (centre.y / size.height) * 2,
          0.5,
        )
        .unproject(camera)
        .sub(camera.position)
        .normalize();
      target
        .copy(camera.position)
        .addScaledVector(ray, (z - camera.position.z) / ray.z);
      if (inspecting) {
        AIM.set(stage.current.pitch, -Math.PI / 2 + stage.current.yaw, 0);
        turn = AIMED.setFromEuler(AIM);
      } else {
        turn = FLOATING;
      }
    }
    const k = approach(POSE_RATE, delta, instant);
    mesh.position.lerp(target, k);
    mesh.quaternion.slerp(turn, k);
    grow.current += (scale - grow.current) * k;
    const settled =
      mesh.position.distanceToSquared(target) < SETTLED &&
      mesh.quaternion.angleTo(turn) < SETTLED &&
      Math.abs(scale - grow.current) < SETTLED;
    if (settled) {
      mesh.position.copy(target);
      mesh.quaternion.copy(turn);
      grow.current = scale;
    }
    mesh.scale.set(
      book.t * grow.current,
      book.h * grow.current,
      book.d * grow.current,
    );
    if (!settled) {
      invalidate();
      return;
    }
    if (mode === 'home' && arrived.current !== book.book.id) {
      arrived.current = book.book.id;
      onHome(book.book.id);
    }
  });

  return (
    <mesh
      ref={meshRef}
      frustumCulled={false}
      geometry={geometry}
      material={pulled.material}
      scale={0}
      raycast={mode === 'home' ? NO_HIT : Mesh.prototype.raycast}
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
