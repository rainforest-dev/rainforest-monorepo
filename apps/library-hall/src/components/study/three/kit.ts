import type {
  Camera,
  Color,
  Material,
  Scene,
  Texture,
  WebGLRenderer,
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';

import type { StudyBackend, ThreeRenderer } from '@/lib';

export type StudyGl = WebGPURenderer | WebGLRenderer;
export type ThreeBackend = Exclude<StudyBackend, 'css'>;

export interface KitFrameInfo {
  drawCalls: number;
  triangles: number;
}

export interface KitTextureMemory {
  textures: number;
  bytes: number | null;
}

export const SPINE_MIX = { selection: 0.22, highlight: 0.45 } as const;
export const SPINE_LIGHT = {
  base: 0.62,
  gain: 0.38,
  dir: [0.3, 0.5, 1],
} as const;

export interface KitCanvasProps {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: WebGLPowerPreference;
}

export const SPINE_ATTRIBUTES = {
  spine: 'aSpine',
  rect: 'aRect',
  side: 'aCol',
  selected: 'aSel',
  highlight: 'aHi',
} as const;

export interface SpineMaterial {
  material: Material;
  setAtlas: (atlas: Texture | null) => void;
  setHighlight: (color: Color) => void;
  setSelection: (color: Color) => void;
}

export interface PulledBookFaces {
  cover: Texture | null;
  back: Texture | null;
  spine: Texture;
  side: Color;
  pages: Color;
}

export interface PulledBookMaterial {
  material: Material;
  point: (faces: PulledBookFaces) => void;
}

export interface StudyMaterials {
  spine: () => SpineMaterial;
  surface: (color: Color) => Material;
  pulledBook: () => PulledBookMaterial;
  setDim: (amount: number) => void;
  dispose: () => void;
}

export type PhotoState = 'building' | 'tracing' | 'done' | 'stopped';

export interface PhotoOptions {
  maxSamples: number;
  renderScale: number;
  denoise: boolean;
  frameBudget: number;
}

export interface PhotoProgress {
  state: PhotoState;
  startedAt: number;
  options: PhotoOptions;
  buildMs: number | null;
  samples: number;
  presentedAt: number | null;
  settledAt: number | null;
  samplesAt: readonly (readonly [number, number])[];
  frameMs: readonly number[];
  triangles: number;
  memoryBytes: number | null;
  memoryPeakBytes: number | null;
}

export interface KitPhoto {
  start(overrides?: Partial<PhotoOptions>): void;
  stop(): void;
  dispose(): void;
}

export type PhotoReport = (progress: PhotoProgress) => void;

export interface StudyKit<Gl extends StudyGl = StudyGl> {
  readonly renderer: ThreeRenderer;
  readonly flat: boolean;
  readonly reportedTargetBuffers: number;
  readonly materials: StudyMaterials;
  createRenderer(props: KitCanvasProps): Gl;
  init(gl: Gl): Promise<void>;
  backendOf(gl: Gl): ThreeBackend;
  programsOf(gl: Gl): number;
  frameInfo(gl: Gl): KitFrameInfo;
  textureMemory(gl: Gl): KitTextureMemory;
  maxAnisotropy(gl: Gl): number;
  uploadTexture(gl: Gl, texture: Texture): void;
  compile(gl: Gl, scene: Scene, camera: Camera): Promise<void>;
  createPhoto?(
    gl: Gl,
    scene: Scene,
    camera: Camera,
    report: PhotoReport,
  ): KitPhoto | null;
}
