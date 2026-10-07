import type { WebGLRenderer } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

import type { StudyKit } from './kit';
import type { kit as glslKit } from './kitGlsl';

type Fits<Actual extends Contract, Contract> = [Actual, Contract];

export type KitContract = [
  Fits<StudyKit<WebGPURenderer>, StudyKit>,
  Fits<StudyKit<WebGLRenderer>, StudyKit>,
  Fits<typeof glslKit, StudyKit>,
];
