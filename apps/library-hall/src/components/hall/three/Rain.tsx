'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  type AmbientLight,
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
} from 'three';

import type { Room } from '@/lib';

/** Drops at a full downpour; a drizzle draws a fraction of them. */
const MAX_DROPS = 3600;
/** How far past the walls the rain reaches, and how high it starts. */
const REACH = 14;
const TOP = 12;
/** The walls are thick and the eaves overhang; keep the rain off them. */
const WALL_CLEARANCE = 0.8;
/**
 * The forecourt the camera looks in over. Rain falls there too, but drawn between the camera
 * and the room it reads as rain indoors, so the hall keeps it to the sides and the back.
 */
const FORECOURT = 9;
const FALL_SPEED = 11;
/** A slight slant, as rain in a breeze. */
const DRIFT_X = 0.12;
const STREAK = 0.7;
/** Rain reads as falling at 30 frames a second; drawing it faster only costs the battery. */
const RAIN_FPS = 30;

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** A point in the rain's box that is not under the hall's roof or in front of its door. */
function dropOutside(room: Room): [number, number] {
  for (;;) {
    const x = random(room.minX - REACH, room.maxX + REACH);
    const z = random(room.minZ - REACH, room.maxZ + REACH + 6);
    const sheltered =
      x > room.minX - WALL_CLEARANCE &&
      x < room.maxX + WALL_CLEARANCE &&
      z > room.minZ - WALL_CLEARANCE &&
      z < room.maxZ + FORECOURT;
    if (!sheltered) return [x, z];
  }
}

/**
 * Rain falling around the hall, never inside it: each drop is a short streak that falls, and
 * starts again at the top somewhere else outside when it reaches the ground. A storm adds a
 * flash of lightning every several seconds. With reduced motion the streaks hang still and no
 * lightning flashes.
 */
export function Rain({
  room,
  rain,
  storm,
  night,
  reducedMotion,
}: {
  room: Room;
  /** 0 to 1. */
  rain: number;
  storm: boolean;
  /** 0 by day, 1 at night: rain catches less light in the dark. */
  night: number;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const count = Math.max(60, Math.round(MAX_DROPS * rain));
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const [x, z] = dropOutside(room);
      const y = random(0, TOP);
      positions.set([x, y, z, x - DRIFT_X * STREAK, y + STREAK, z], i * 6);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    return g;
  }, [count, room]);
  const material = useMemo(
    () =>
      new LineBasicMaterial({
        color: night > 0.5 ? 0xaab6cc : 0xdde5ef,
        transparent: true,
        opacity: 0.5 + 0.3 * rain,
        depthWrite: false,
      }),
    [night, rain],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const flash = useRef<AmbientLight>(null);
  const nextFlash = useRef(0);
  const flashUntil = useRef(0);

  // The hall draws only when something moves; rain moves all the time, but 30 frames a second
  // is enough for it.
  useEffect(() => {
    invalidate();
    if (reducedMotion) return;
    const id = window.setInterval(() => invalidate(), 1000 / RAIN_FPS);
    return () => window.clearInterval(id);
  }, [geometry, invalidate, reducedMotion]);

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return;
    const step = Math.min(delta, 0.1) * FALL_SPEED;
    const attribute = geometry.getAttribute('position') as BufferAttribute;
    const p = attribute.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      let y = (p[o + 1] ?? 0) - step;
      let x = (p[o] ?? 0) - step * DRIFT_X;
      let z = p[o + 2] ?? 0;
      if (y < 0) {
        [x, z] = dropOutside(room);
        y = TOP;
      }
      p[o] = x;
      p[o + 1] = y;
      p[o + 2] = z;
      p[o + 3] = x - DRIFT_X * STREAK;
      p[o + 4] = y + STREAK;
      p[o + 5] = z;
    }
    attribute.needsUpdate = true;

    const light = flash.current;
    if (storm && light) {
      const t = clock.elapsedTime;
      if (nextFlash.current === 0) nextFlash.current = t + random(4, 10);
      if (t >= nextFlash.current) {
        flashUntil.current = t + random(0.08, 0.18);
        nextFlash.current = t + random(6, 14);
      }
      light.intensity = t < flashUntil.current ? 2.5 + 1.5 * night : 0;
    }
  });

  return (
    <>
      <lineSegments
        geometry={geometry}
        material={material}
        frustumCulled={false}
      />
      {storm && <ambientLight ref={flash} color={0xdde6ff} intensity={0} />}
    </>
  );
}
