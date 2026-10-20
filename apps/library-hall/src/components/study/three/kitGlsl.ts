import { NoToneMapping, WebGLRenderer } from 'three';

import { createGlslMaterials } from './glslMaterial';
import type { StudyKit } from './kit';

const seenPrograms = new WeakMap<WebGLRenderer, Set<number>>();

function notePrograms(gl: WebGLRenderer): void {
  const seen = seenPrograms.get(gl) ?? new Set<number>();
  for (const program of gl.info.programs ?? []) seen.add(program.id);
  seenPrograms.set(gl, seen);
}

export const kit: StudyKit<WebGLRenderer> = {
  renderer: 'three-glsl',
  flat: true,
  reportedTargetBuffers: 0,
  materials: createGlslMaterials(),
  createRenderer({ powerPreference, ...props }) {
    const gl = new WebGLRenderer({
      ...props,
      antialias: true,
      powerPreference,
    });
    gl.toneMapping = NoToneMapping;
    return gl;
  },
  init: async () => undefined,
  backendOf: () => 'webgl2',
  programsOf: (gl) => {
    notePrograms(gl);
    return seenPrograms.get(gl)?.size ?? 0;
  },
  frameInfo: (gl) => {
    notePrograms(gl);
    return {
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
    };
  },
  textureMemory: (gl) => ({
    textures: gl.info.memory.textures,
    bytes: null,
  }),
  maxAnisotropy: (gl) => gl.capabilities.getMaxAnisotropy(),
  uploadTexture: (gl, texture) => {
    gl.initTexture(texture);
  },
  compile: async (gl, scene, camera) => {
    // compileAsync logs a warning when KHR_parallel_shader_compile is missing.
    if (gl.extensions.has('KHR_parallel_shader_compile'))
      await gl.compileAsync(scene, camera);
    else gl.compile(scene, camera);
  },
};
