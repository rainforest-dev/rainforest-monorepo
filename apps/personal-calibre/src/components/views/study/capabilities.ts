import type { ThreeRenderer } from '@/lib';

export function hasWebGpuApi(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { gpu?: unknown }).gpu !== undefined
  );
}

export function canUseWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

export function canStartRenderer(renderer: ThreeRenderer): boolean {
  switch (renderer) {
    case 'three-tsl':
      return hasWebGpuApi() || canUseWebGL2();
    case 'three-glsl':
      return canUseWebGL2();
  }
}
