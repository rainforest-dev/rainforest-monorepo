import type { Camera, Color, Material, Scene } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

import type { StudyBackend, ThreeRenderer } from '@/lib';

export type StudyGl = WebGPURenderer;

export interface KitCanvasProps {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: WebGLPowerPreference;
}

export interface StudyMaterials {
  spine: () => Material;
  surface: (color: Color) => Material;
}

export interface StudyKit {
  renderer: ThreeRenderer;
  createRenderer: (props: KitCanvasProps) => Promise<StudyGl>;
  backendOf: (gl: StudyGl) => Exclude<StudyBackend, 'css'>;
  materials: StudyMaterials;
  compile: (gl: StudyGl, scene: Scene, camera: Camera) => Promise<void>;
  flat: boolean;
}
