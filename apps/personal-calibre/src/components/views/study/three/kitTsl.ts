import { NoToneMapping, UnsignedByteType } from 'three';
import { WebGPURenderer } from 'three/webgpu';

import { hasWebGpuApi } from '@/components/views/study/capabilities';

import type { StudyGl, StudyKit } from './kit';
import { createStudyMaterials } from './studyMaterial';

type ProgramInfo = StudyGl['info'] & {
  createProgram: (program: unknown) => void;
};

const createdPrograms = new WeakMap<StudyGl, number>();

function countPrograms(gl: StudyGl): void {
  const info = gl.info as ProgramInfo;
  const createProgram = info.createProgram.bind(info);
  createdPrograms.set(gl, 0);
  info.createProgram = (program) => {
    createdPrograms.set(gl, (createdPrograms.get(gl) ?? 0) + 1);
    createProgram(program);
  };
}

const createRenderer: StudyKit['createRenderer'] = async ({
  powerPreference,
  ...props
}) => {
  const gl = new WebGPURenderer({
    ...props,
    powerPreference:
      powerPreference === 'default' ? undefined : powerPreference,
    antialias: true,
    outputBufferType: UnsignedByteType,
    forceWebGL: !hasWebGpuApi(),
  });
  gl.toneMapping = NoToneMapping;
  countPrograms(gl);
  await gl.init();
  return gl;
};

export const kit: StudyKit = {
  renderer: 'three-tsl',
  createRenderer,
  backendOf: (gl) =>
    (gl.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
      ? 'webgpu'
      : 'webgl2',
  programsOf: (gl) => createdPrograms.get(gl) ?? 0,
  materials: createStudyMaterials(),
  compile: async (gl, scene, camera) => {
    await gl.compileAsync(scene, camera);
  },
  flat: true,
};
