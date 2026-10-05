import { NoToneMapping, UnsignedByteType } from 'three';
import {
  attribute,
  dot,
  float,
  max,
  normalize,
  normalWorld,
  vec3,
} from 'three/tsl';
import { MeshBasicNodeMaterial, WebGPURenderer } from 'three/webgpu';

import { hasWebGpuApi } from '@/components/views/study/capabilities';

import type { StudyKit } from './kit';

const light = () =>
  float(0.62).add(
    float(0.38).mul(max(dot(normalWorld, normalize(vec3(0.3, 0.5, 1))), 0)),
  );

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
  materials: {
    spine: () => {
      const material = new MeshBasicNodeMaterial();
      material.colorNode = attribute('aCol', 'vec3').mul(light());
      return material;
    },
    surface: (color) => {
      const material = new MeshBasicNodeMaterial();
      material.color.copy(color);
      return material;
    },
  },
  compile: async (gl, scene, camera) => {
    await gl.compileAsync(scene, camera);
  },
  flat: true,
};
