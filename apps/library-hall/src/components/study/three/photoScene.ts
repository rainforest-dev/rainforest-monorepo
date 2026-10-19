import {
  BufferGeometry,
  type Camera,
  Color,
  DataTexture,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  FloatType,
  type InstancedMesh,
  LinearFilter,
  type Material,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  RectAreaLight,
  RGBAFormat,
  Scene,
  type Texture,
  Vector3,
} from 'three';

import {
  type KitPhoto,
  type PhotoOptions,
  type PhotoProgress,
  type PhotoReport,
  type PulledBookFaces,
  SPINE_ATTRIBUTES,
  SPINE_MIX,
  type SpineMaterial,
  type StudyMaterials,
} from './kit';

interface SpineState {
  atlas: Texture | null;
  selection: Color;
  highlight: Color;
}

export interface TrackedMaterials {
  materials: StudyMaterials;
  spineOf: (material: Material) => SpineState | undefined;
  facesOf: (material: Material) => PulledBookFaces | null | undefined;
  dim: () => number;
}

export function trackMaterials(base: StudyMaterials): TrackedMaterials {
  const spines = new WeakMap<Material, SpineState>();
  const pulled = new WeakMap<Material, PulledBookFaces | null>();
  let dim = 0;
  const spine = (): SpineMaterial => {
    const made = base.spine();
    const state: SpineState = {
      atlas: null,
      selection: new Color(),
      highlight: new Color(),
    };
    spines.set(made.material, state);
    return {
      material: made.material,
      setAtlas: (atlas) => {
        state.atlas = atlas;
        made.setAtlas(atlas);
      },
      setHighlight: (color) => {
        state.highlight.copy(color);
        made.setHighlight(color);
      },
      setSelection: (color) => {
        state.selection.copy(color);
        made.setSelection(color);
      },
    };
  };
  return {
    materials: {
      ...base,
      spine,
      pulledBook: () => {
        const made = base.pulledBook();
        pulled.set(made.material, null);
        return {
          material: made.material,
          point: (faces) => {
            pulled.set(made.material, {
              ...faces,
              side: faces.side.clone(),
              pages: faces.pages.clone(),
            });
            made.point(faces);
          },
        };
      },
      setDim: (amount) => {
        dim = amount;
        base.setDim(amount);
      },
    },
    spineOf: (material) => spines.get(material),
    facesOf: (material) => pulled.get(material),
    dim: () => dim,
  };
}

const FRONT_GROUP = 4;
const WHITE = new Color(1, 1, 1);
const ROUGHNESS = { spine: 0.85, surface: 1, pages: 1 } as const;
const ENVIRONMENT = { zenith: 1.05, horizon: 1, nadir: 0.9 } as const;
const ENVIRONMENT_INTENSITY = 0.92;
const FILL = { panel: 0.22, boards: 0.12 } as const;
const KEY = {
  offset: [2, 2.5, 10] as const,
  width: 6,
  height: 4,
  intensity: 1,
};

type UvMap = (u: number, v: number) => readonly [number, number];

class Batch {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private colors: number[] = [];
  private readonly point = new Vector3();
  private readonly normal = new Vector3();

  get empty(): boolean {
    return this.positions.length === 0;
  }

  append(
    source: BufferGeometry,
    keep: (group: number) => boolean,
    matrix: Matrix4,
    normalMatrix: Matrix3,
    color: Color,
    uvMap?: UvMap,
  ): void {
    const index = source.index;
    const position = source.getAttribute('position');
    const normal = source.getAttribute('normal');
    const uv = source.getAttribute('uv');
    source.groups.forEach((group, g) => {
      if (!keep(g)) return;
      for (let k = group.start; k < group.start + group.count; k++) {
        const i = index ? index.getX(k) : k;
        this.point.fromBufferAttribute(position, i).applyMatrix4(matrix);
        this.normal
          .fromBufferAttribute(normal, i)
          .applyMatrix3(normalMatrix)
          .normalize();
        const u = uv.getX(i);
        const v = uv.getY(i);
        const [mu, mv] = uvMap ? uvMap(u, v) : [u, v];
        this.positions.push(this.point.x, this.point.y, this.point.z);
        this.normals.push(this.normal.x, this.normal.y, this.normal.z);
        this.uvs.push(mu, mv);
        this.colors.push(color.r, color.g, color.b);
      }
    });
  }

  geometry(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute(
      'normal',
      new Float32BufferAttribute(this.normals, 3),
    );
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    return geometry;
  }
}

function tint(
  base: Color,
  state: SpineState,
  selected: number,
  highlighted: number,
  dim: number,
): Color {
  return base
    .clone()
    .lerp(state.selection, selected * SPINE_MIX.selection)
    .lerp(state.highlight, highlighted * SPINE_MIX.highlight)
    .multiplyScalar(1 - dim);
}

function gradientEnvironment(): DataTexture {
  const height = 32;
  const data = new Float32Array(2 * height * 4);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const value =
      t < 0.5
        ? ENVIRONMENT.nadir + (ENVIRONMENT.horizon - ENVIRONMENT.nadir) * t * 2
        : ENVIRONMENT.horizon +
          (ENVIRONMENT.zenith - ENVIRONMENT.horizon) * (t - 0.5) * 2;
    for (let x = 0; x < 2; x++) {
      data.set([value, value, value, 1], (y * 2 + x) * 4);
    }
  }
  const texture = new DataTexture(data, 2, height, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export interface PhotoScene {
  scene: Scene;
  triangles: number;
  textures: readonly Texture[];
  dispose: () => void;
}

export function buildPhotoScene(
  source: Scene,
  camera: Camera,
  tracked: TrackedMaterials,
): PhotoScene {
  source.updateMatrixWorld();
  const scene = new Scene();
  const owned: { dispose: () => void }[] = [];
  const textures = new Set<Texture>();
  const matrix = new Matrix4();
  const instance = new Matrix4();
  const normalMatrix = new Matrix3();
  const dim = tracked.dim();
  let triangles = 0;

  const standard = (
    params: ConstructorParameters<typeof MeshStandardMaterial>[0],
  ) => {
    const material = new MeshStandardMaterial(params);
    owned.push(material);
    if (material.map) textures.add(material.map);
    return material;
  };
  const add = (geometry: BufferGeometry, material: Material | Material[]) => {
    owned.push(geometry);
    triangles +=
      (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    scene.add(new Mesh(geometry, material));
  };

  source.traverseVisible((object) => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh<BufferGeometry, Material>;
    const material = mesh.material;
    const spine = tracked.spineOf(material);
    const faces = tracked.facesOf(material);
    const instanced = (mesh as InstancedMesh).isInstancedMesh
      ? (mesh as InstancedMesh)
      : null;

    if (spine && instanced) {
      const geometry = instanced.geometry;
      const rect = geometry.getAttribute(SPINE_ATTRIBUTES.rect);
      const side = geometry.getAttribute(SPINE_ATTRIBUTES.side);
      const selected = geometry.getAttribute(SPINE_ATTRIBUTES.selected);
      const highlighted = geometry.getAttribute(SPINE_ATTRIBUTES.highlight);
      const fronts = new Batch();
      const sides = new Batch();
      for (let i = 0; i < instanced.count; i++) {
        instanced.getMatrixAt(i, instance);
        if (instance.determinant() === 0) continue;
        matrix.multiplyMatrices(instanced.matrixWorld, instance);
        normalMatrix.getNormalMatrix(matrix);
        const sel = selected.getX(i);
        const hi = highlighted.getX(i);
        const sideColor = tint(
          new Color(side.getX(i), side.getY(i), side.getZ(i)),
          spine,
          sel,
          hi,
          dim,
        );
        if (!spine.atlas) {
          sides.append(geometry, () => true, matrix, normalMatrix, sideColor);
          continue;
        }
        const [u0, v0, du, dv] = [
          rect.getX(i),
          rect.getY(i),
          rect.getZ(i),
          rect.getW(i),
        ];
        fronts.append(
          geometry,
          (g) => g === FRONT_GROUP,
          matrix,
          normalMatrix,
          tint(WHITE, spine, sel, hi, dim),
          (u, v) => [u0 + u * du, v0 + v * dv],
        );
        sides.append(
          geometry,
          (g) => g !== FRONT_GROUP,
          matrix,
          normalMatrix,
          sideColor,
        );
      }
      if (!fronts.empty) {
        add(
          fronts.geometry(),
          standard({
            map: spine.atlas,
            vertexColors: true,
            roughness: ROUGHNESS.spine,
          }),
        );
      }
      if (!sides.empty) {
        add(
          sides.geometry(),
          standard({ vertexColors: true, roughness: ROUGHNESS.spine }),
        );
      }
      return;
    }

    if (faces !== undefined) {
      if (!faces || mesh.matrixWorld.determinant() === 0) return;
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const side = faces.side.clone().multiplyScalar(1 - dim);
      const pages = faces.pages.clone().multiplyScalar(1 - dim);
      const face = (map: Texture | null) =>
        map
          ? standard({ map, roughness: ROUGHNESS.spine })
          : standard({ color: side, roughness: ROUGHNESS.spine });
      const pageMaterial = standard({
        color: pages,
        roughness: ROUGHNESS.pages,
      });
      add(geometry, [
        face(faces.cover),
        face(faces.back),
        pageMaterial,
        pageMaterial,
        face(faces.spine),
        face(null),
      ]);
      return;
    }

    const color = (material as Material & { color?: Color }).color;
    if (!color) return;
    const surface = (fill: number) =>
      standard({
        color: color.clone(),
        emissive: color.clone().multiplyScalar(fill),
        roughness: ROUGHNESS.surface,
      });
    if (!instanced) {
      add(
        mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
        surface(FILL.panel),
      );
      return;
    }
    const batch = new Batch();
    for (let i = 0; i < instanced.count; i++) {
      instanced.getMatrixAt(i, instance);
      if (instance.determinant() === 0) continue;
      matrix.multiplyMatrices(instanced.matrixWorld, instance);
      normalMatrix.getNormalMatrix(matrix);
      batch.append(instanced.geometry, () => true, matrix, normalMatrix, WHITE);
    }
    if (!batch.empty) add(batch.geometry(), surface(FILL.boards));
  });

  const environment = gradientEnvironment();
  owned.push(environment);
  scene.environment = environment;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;

  camera.updateMatrixWorld();
  const view = new Vector3();
  camera.getWorldDirection(view);
  const target = camera.position
    .clone()
    .addScaledVector(view, camera.position.z / Math.max(-view.z, 1e-3));
  const key = new RectAreaLight(0xffffff, KEY.intensity, KEY.width, KEY.height);
  key.position.set(
    target.x + KEY.offset[0],
    target.y + KEY.offset[1],
    target.z + KEY.offset[2],
  );
  key.lookAt(target);
  scene.add(key);

  return {
    scene,
    triangles,
    textures: [...textures],
    dispose: () => {
      for (const item of owned) item.dispose();
    },
  };
}

export interface PhotoTracer {
  load: (scene: Scene, camera: Camera) => void;
  sample: () => void;
  samples: () => number;
  presented: () => boolean;
  settled: () => boolean;
  memoryBytes: () => number;
  dispose: () => void;
}

const FRAME_SAMPLES = 600;

export function createPhotoRunner({
  createTracer,
  defaults,
  source,
  camera,
  tracked,
  report,
}: {
  createTracer: (options: PhotoOptions) => PhotoTracer;
  defaults: PhotoOptions;
  source: Scene;
  camera: Camera;
  tracked: TrackedMaterials;
  report: PhotoReport;
}): KitPhoto {
  let frame = 0;
  let built: PhotoScene | null = null;
  let tracer: PhotoTracer | null = null;
  let progress: PhotoProgress | null = null;

  const publish = (patch: Partial<PhotoProgress>) => {
    if (!progress) return;
    progress = { ...progress, ...patch };
    report(progress);
  };

  const release = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    tracer?.dispose();
    tracer = null;
    built?.dispose();
    built = null;
  };

  return {
    start: (overrides) => {
      release();
      const options = { ...defaults, ...overrides };
      const startedAt = performance.now();
      progress = {
        state: 'building',
        startedAt,
        options,
        buildMs: null,
        samples: 0,
        presentedAt: null,
        settledAt: null,
        samplesAt: [],
        frameMs: [],
        triangles: 0,
        memoryBytes: null,
        memoryPeakBytes: null,
      };
      report(progress);
      built = buildPhotoScene(source, camera, tracked);
      const active = createTracer(options);
      tracer = active;
      active.load(built.scene, camera);
      const loadedAt = performance.now();
      publish({
        state: 'tracing',
        buildMs: loadedAt - startedAt,
        triangles: built.triangles,
      });
      const samplesAt: [number, number][] = [];
      const frameMs: number[] = [];
      let peak = 0;
      const tick = () => {
        const begin = performance.now();
        active.sample();
        const end = performance.now();
        frameMs.push(end - begin);
        if (frameMs.length > FRAME_SAMPLES) frameMs.shift();
        const samples = active.samples();
        samplesAt.push([end - loadedAt, samples]);
        const memory = active.memoryBytes();
        peak = Math.max(peak, memory);
        const settled = active.settled();
        publish({
          samples,
          presentedAt:
            progress?.presentedAt ??
            (active.presented() ? end - loadedAt : null),
          settledAt: settled ? end - loadedAt : null,
          samplesAt,
          frameMs,
          memoryBytes: memory,
          memoryPeakBytes: peak,
        });
        if (settled) {
          frame = 0;
          publish({ state: 'done' });
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    stop: () => {
      const active = tracer !== null;
      release();
      if (active) publish({ state: 'stopped' });
    },
    dispose: release,
  };
}
