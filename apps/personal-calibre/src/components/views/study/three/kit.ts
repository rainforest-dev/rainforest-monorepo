import type { Camera, Color, Material, Scene, Texture } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

import type { StudyBackend, ThreeRenderer } from '@/lib';

export type StudyGl = WebGPURenderer;

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

export interface StudyKit {
  renderer: ThreeRenderer;
  createRenderer: (props: KitCanvasProps) => Promise<StudyGl>;
  backendOf: (gl: StudyGl) => Exclude<StudyBackend, 'css'>;
  programsOf: (gl: StudyGl) => number;
  materials: StudyMaterials;
  compile: (gl: StudyGl, scene: Scene, camera: Camera) => Promise<void>;
  flat: boolean;
}
