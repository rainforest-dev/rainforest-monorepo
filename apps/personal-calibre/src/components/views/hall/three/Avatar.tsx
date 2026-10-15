import { useFrame } from '@react-three/fiber';
import { type RefObject, useRef } from 'react';
import type { Group } from 'three';

/**
 * Style only, picked by eye from the owner's public profile photos: short dark hair, round
 * tortoiseshell glasses, an oversized black shirt with a pale embroidered sprig, wide grey trousers.
 */
export const AVATAR_STYLE = {
  skin: '#e6c3a5',
  hair: '#141414',
  glasses: '#3b2a1f',
  shirt: '#1c1c1e',
  embroidery: '#c8ccd8',
  trousers: '#b7b9bd',
  shoes: '#2b2b2b',
} as const;

export interface AvatarMotion {
  /** Advances with distance walked; drives the stride. */
  phase: number;
  /** 0 standing, 1 mid-walk; eases between so the stride settles instead of snapping. */
  stride: number;
}

const SWING_LEG = 0.55;
const SWING_ARM = 0.4;

interface LimbProps {
  limbRef: RefObject<Group | null>;
  x: number;
}

function Leg({ limbRef, x }: LimbProps) {
  return (
    <group ref={limbRef} position={[x, 0.86, 0]}>
      <mesh position-y={-0.4}>
        <cylinderGeometry args={[0.1, 0.125, 0.8, 6]} />
        <meshLambertMaterial color={AVATAR_STYLE.trousers} flatShading />
      </mesh>
      <mesh position={[0, -0.82, 0.04]}>
        <boxGeometry args={[0.13, 0.08, 0.26]} />
        <meshLambertMaterial color={AVATAR_STYLE.shoes} flatShading />
      </mesh>
    </group>
  );
}

function Arm({ limbRef, x }: LimbProps) {
  return (
    <group ref={limbRef} position={[x, 1.45, 0]}>
      <mesh position-y={-0.3}>
        <cylinderGeometry args={[0.075, 0.095, 0.62, 6]} />
        <meshLambertMaterial color={AVATAR_STYLE.shirt} flatShading />
      </mesh>
      <mesh position-y={-0.65}>
        <icosahedronGeometry args={[0.05, 0]} />
        <meshLambertMaterial color={AVATAR_STYLE.skin} flatShading />
      </mesh>
    </group>
  );
}

/** A low-poly figure about 1.75 m tall, standing at its group's origin and facing +z. */
export function Avatar({ motion }: { motion: RefObject<AvatarMotion> }) {
  const body = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const s = AVATAR_STYLE;

  useFrame(() => {
    const { phase, stride } = motion.current;
    const swing = Math.sin(phase) * stride;
    if (legL.current) legL.current.rotation.x = swing * SWING_LEG;
    if (legR.current) legR.current.rotation.x = -swing * SWING_LEG;
    if (armL.current) armL.current.rotation.x = -swing * SWING_ARM;
    if (armR.current) armR.current.rotation.x = swing * SWING_ARM;
    if (body.current)
      body.current.position.y = Math.abs(Math.sin(phase)) * 0.035 * stride;
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.005}>
        <circleGeometry args={[0.34, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
      <group ref={body}>
        <Leg limbRef={legL} x={-0.11} />
        <Leg limbRef={legR} x={0.11} />
        <mesh position-y={1.16}>
          <cylinderGeometry args={[0.25, 0.31, 0.7, 6]} />
          <meshLambertMaterial color={s.shirt} flatShading />
        </mesh>
        <mesh position={[0.12, 1.02, 0.275]} rotation-z={0.5}>
          <boxGeometry args={[0.025, 0.16, 0.01]} />
          <meshLambertMaterial color={s.embroidery} />
        </mesh>
        <mesh position={[0.15, 1.07, 0.27]} rotation-z={-0.6}>
          <boxGeometry args={[0.02, 0.08, 0.01]} />
          <meshLambertMaterial color={s.embroidery} />
        </mesh>
        <Arm limbRef={armL} x={-0.33} />
        <Arm limbRef={armR} x={0.33} />
        <mesh position-y={1.54}>
          <cylinderGeometry args={[0.055, 0.06, 0.1, 6]} />
          <meshLambertMaterial color={s.skin} flatShading />
        </mesh>
        <group position-y={1.69}>
          <mesh scale={[1, 1.12, 1]}>
            <icosahedronGeometry args={[0.15, 1]} />
            <meshLambertMaterial color={s.skin} flatShading />
          </mesh>
          <mesh position={[0, 0.06, -0.015]} scale={[1.05, 0.75, 1.06]}>
            <icosahedronGeometry args={[0.155, 1]} />
            <meshLambertMaterial color={s.hair} flatShading />
          </mesh>
          {[-0.058, 0.058].map((x) => (
            <mesh key={x} position={[x, 0.01, 0.145]}>
              <torusGeometry args={[0.045, 0.009, 4, 10]} />
              <meshLambertMaterial color={s.glasses} />
            </mesh>
          ))}
          <mesh position={[0, 0.015, 0.15]}>
            <boxGeometry args={[0.03, 0.009, 0.009]} />
            <meshLambertMaterial color={s.glasses} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
