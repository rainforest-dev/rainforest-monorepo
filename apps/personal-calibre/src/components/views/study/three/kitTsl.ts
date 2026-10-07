import { NoToneMapping, UnsignedByteType } from 'three';
import { WebGPURenderer } from 'three/webgpu';

import { hasWebGpuApi } from '@/components/views/study/capabilities';

import type { StudyKit } from './kit';
import { createStudyMaterials } from './studyMaterial';

type ProgramInfo = WebGPURenderer['info'] & {
  createProgram: (program: unknown) => void;
};

const createdPrograms = new WeakMap<WebGPURenderer, number>();

function countPrograms(gl: WebGPURenderer): void {
  const info = gl.info as ProgramInfo;
  const createProgram = info.createProgram.bind(info);
  createdPrograms.set(gl, 0);
  info.createProgram = (program) => {
    createdPrograms.set(gl, (createdPrograms.get(gl) ?? 0) + 1);
    createProgram(program);
  };
}

function disposeOnce(gl: WebGPURenderer): void {
  const dispose = gl.dispose.bind(gl);
  let disposing: Promise<void> | null = null;
  gl.dispose = () => (disposing ??= dispose());
}

export const kit: StudyKit<WebGPURenderer> = {
  renderer: 'three-tsl',
  flat: true,
  reportedTargetBuffers: 2,
  materials: createStudyMaterials(),
  createRenderer({ powerPreference, ...props }) {
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
    disposeOnce(gl);
    return gl;
  },
  init: async (gl) => {
    await gl.init();
  },
  backendOf: (gl) =>
    (gl.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
      ? 'webgpu'
      : 'webgl2',
  programsOf: (gl) => createdPrograms.get(gl) ?? 0,
  frameInfo: (gl) => ({
    drawCalls: gl.info.render.drawCalls,
    triangles: gl.info.render.triangles,
  }),
  textureMemory: (gl) => ({
    textures: gl.info.memory.textures,
    bytes: gl.info.memory.texturesSize,
  }),
  maxAnisotropy: (gl) => gl.getMaxAnisotropy(),
  uploadTexture: (gl, texture) => {
    if (gl.hasInitialized()) gl.initTexture(texture);
  },
  compile: async (gl, scene, camera) => {
    await gl.compileAsync(scene, camera);
  },
};
