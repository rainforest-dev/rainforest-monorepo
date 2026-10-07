import type { WebGLRenderer } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

import type { StudyKit } from './kit';

type Fits<Actual extends Contract, Contract> = [Actual, Contract];

export type KitContract = [
  Fits<StudyKit<WebGPURenderer>, StudyKit>,
  Fits<StudyKit<WebGLRenderer>, StudyKit>,
];
