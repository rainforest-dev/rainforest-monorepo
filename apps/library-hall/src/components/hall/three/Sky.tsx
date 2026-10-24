'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BackSide,
  Color,
  type DirectionalLight,
  type Mesh,
  Object3D,
  ShaderMaterial,
  Vector3,
} from 'three';

import { mixRgb, type Rgb, toColor } from '@/components/study/three/tokens';
import {
  type HallLayout,
  type HallWeather,
  skyLight,
  sunDirection,
  sunPosition,
  weatherSky,
} from '@/lib';

import { Rain } from './Rain';

const SKY_RADIUS = 100;
const DISC_DISTANCE = 90;
/** Where the moon stands at night: high in the south, so it lights the way in. */
const MOON = new Vector3(-0.35, 0.8, 0.5).normalize();

interface SkyUniforms {
  [name: string]: { value: Color };
  zenith: { value: Color };
  horizon: { value: Color };
  ground: { value: Color };
}

const skyMaterial = (uniforms: SkyUniforms) =>
  new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith;
      uniform vec3 horizon;
      uniform vec3 ground;
      varying vec3 vDirection;
      void main() {
        float h = normalize(vDirection).y;
        vec3 colour = h > 0.0
          ? mix(horizon, zenith, pow(h, 0.55))
          : mix(horizon, ground, min(1.0, -h * 5.0));
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

/**
 * The sky, the sun and the light they cast, set from the real sun over Taipei and the weather
 * there: a gradient dome, the sun's disc (or the moon's) unless cloud hides it, one
 * shadow-casting light from where it stands, the sky's fill light, the hall's lamps, which come
 * up as the daylight goes, and rain past the windows.
 */
export function HallSky({
  layout,
  now,
  weather,
  reducedMotion,
}: {
  layout: HallLayout;
  now: Date;
  weather: HallWeather | null;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const sun = useMemo(() => sunPosition(now), [now]);
  const sky = useMemo(
    () => weatherSky(skyLight(sun.elevation), weather),
    [sun, weather],
  );
  // One switch for the light's colour, strength and direction, so none of them jumps alone.
  const up = sky.sunUp;
  const direction = useMemo(() => {
    if (!up) return MOON.clone();
    const d = sunDirection(sun);
    // Keep a sun on the horizon a little above it, so its light still has a direction.
    return new Vector3(d.x, Math.max(d.y, 0.06), d.z).normalize();
  }, [sun, up]);

  const { room } = layout;
  const centreZ = (room.minZ + room.maxZ) / 2;
  const reach = Math.max(room.maxX - room.minX, room.maxZ - room.minZ) / 2 + 10;
  const target = useMemo(() => new Object3D(), []);
  const light = useRef<DirectionalLight>(null);
  const dome = useRef<Mesh>(null);
  const disc = useRef<Mesh>(null);
  const uniforms = useMemo<SkyUniforms>(
    () => ({
      zenith: { value: new Color() },
      horizon: { value: new Color() },
      ground: { value: new Color() },
    }),
    [],
  );
  const material = useMemo(() => skyMaterial(uniforms), [uniforms]);
  useEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    uniforms.zenith.value.copy(toColor(sky.zenith));
    uniforms.horizon.value.copy(toColor(sky.horizon));
    uniforms.ground.value.copy(toColor(sky.ground));
    target.position.set(0, 0, centreZ);
    target.updateMatrixWorld();
    const l = light.current;
    if (l) {
      l.position.copy(direction).multiplyScalar(45).add(target.position);
      const cam = l.shadow.camera;
      cam.left = -reach;
      cam.right = reach;
      cam.top = reach;
      cam.bottom = -reach;
      cam.near = 1;
      cam.far = 100;
      cam.updateProjectionMatrix();
      l.shadow.needsUpdate = true;
    }
    invalidate();
  }, [sky, direction, centreZ, reach, uniforms, target, invalidate]);

  // The dome and the disc travel with the camera, so neither can be walked up to.
  useFrame(({ camera }) => {
    dome.current?.position.copy(camera.position);
    disc.current?.position
      .copy(direction)
      .multiplyScalar(DISC_DISTANCE)
      .add(camera.position);
  });

  const lamps = layout.furniture.filter((f) => f.kind === 'lamp');
  const day = 1 - sky.night;
  const lampColour: Rgb = [255, 214, 160];
  return (
    <>
      <color attach="background" args={[toColor(sky.horizon)]} />
      <fog
        attach="fog"
        args={[toColor(sky.horizon), sky.fogNear, sky.fogFar]}
      />
      <mesh
        ref={dome}
        material={material}
        renderOrder={-1}
        frustumCulled={false}
      >
        <sphereGeometry args={[SKY_RADIUS, 32, 16]} />
      </mesh>
      <mesh ref={disc} frustumCulled={false} visible={sky.discVisible}>
        <sphereGeometry args={[up ? 3.2 : 2.2, 24, 12]} />
        <meshBasicMaterial
          color={toColor(
            up ? mixRgb(sky.sun, [255, 255, 255], 0.5) : [226, 232, 246],
          )}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        color={toColor(sky.sun)}
        intensity={sky.sunIntensity * 1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
      <hemisphereLight
        args={[
          // Indoors the sky arrives as warm, diffuse light off the walls; at night the room's
          // own lighting stands in for it.
          toColor(
            mixRgb(
              lampColour,
              mixRgb([250, 244, 232], sky.horizon, 0.6),
              sky.night * 0.7,
            ),
          ),
          toColor(mixRgb(sky.ground, [120, 96, 72], 0.5)),
          (1 + 0.7 * day + 0.5 * sky.night) * sky.fill,
        ]}
      />
      <ambientLight intensity={sky.ambientIntensity * 1.2} />
      {/* Daylight bouncing in over the front wall: no shadow, so the shelves never go black. */}
      <directionalLight
        position={[2, 6, room.maxZ + 8]}
        color={toColor(mixRgb(sky.sun, sky.horizon, 0.5))}
        intensity={(0.35 + 0.9 * day) * sky.fill}
      />
      {lamps.map((lamp) => (
        <pointLight
          key={`${lamp.x},${lamp.z}`}
          position={[lamp.x, 1.7, lamp.z]}
          color={toColor(lampColour)}
          intensity={sky.lampIntensity * 6}
          distance={14}
          decay={1.4}
        />
      ))}
      {weather && weather.rain > 0 && (
        <Rain
          room={room}
          rain={weather.rain}
          storm={weather.kind === 'storm'}
          night={sky.night}
          reducedMotion={reducedMotion}
        />
      )}
    </>
  );
}
