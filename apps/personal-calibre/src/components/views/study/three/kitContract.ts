import type { WebGLRenderer } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

import type { StudyKit } from './kit';
import type { kit as glslKit } from './kitGlsl';
import type { kit as pathtraceKit } from './kitPathtrace';

type Fits<Actual extends Contract, Contract> = [Actual, Contract];

export type KitContract = [
  Fits<StudyKit<WebGPURenderer>, StudyKit>,
  Fits<StudyKit<WebGLRenderer>, StudyKit>,
  Fits<typeof glslKit, StudyKit>,
  Fits<typeof pathtraceKit, StudyKit>,
];
