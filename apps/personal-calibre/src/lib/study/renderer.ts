import { type Renderer, RENDERERS } from '@/lib/prefs';

export type ThreeRenderer = Exclude<Renderer, 'css'>;
export type StudyBackend = 'webgpu' | 'webgl2' | 'css';

export const ENABLED_RENDERERS: readonly Renderer[] = ['three-tsl', 'css'];
export const PREVIEW_RENDERERS: readonly Renderer[] = ['three-glsl'];

export const RENDERER_LABELS: Record<Renderer, string> = {
  'three-tsl': 'three.js · TSL',
  css: 'CSS',
  'three-glsl': 'three.js · GLSL',
};

export interface RendererInput {
  param: string | null;
  pref: Renderer;
  sessionFallback: boolean;
  enabled?: readonly Renderer[];
  preview?: readonly Renderer[];
}

export function pickRenderer({
  param,
  pref,
  sessionFallback,
  enabled = ENABLED_RENDERERS,
  preview = PREVIEW_RENDERERS,
}: RendererInput): Renderer {
  if (sessionFallback) return 'css';
  const wanted = RENDERERS.find((r) => r === param);
  if (wanted && (enabled.includes(wanted) || preview.includes(wanted)))
    return wanted;
  if (enabled.includes(pref)) return pref;
  return enabled[0] ?? 'css';
}

export function isThreeRenderer(renderer: Renderer): renderer is ThreeRenderer {
  return renderer !== 'css';
}

const BACKEND_NAMES: Record<Exclude<StudyBackend, 'css'>, string> = {
  webgpu: 'WebGPU',
  webgl2: 'WebGL2',
};

export function rendererLabel(
  renderer: Renderer,
  backend: StudyBackend | null,
): string {
  const label = RENDERER_LABELS[renderer];
  if (renderer === 'css' || backend === null || backend === 'css') return label;
  return `${label} · ${BACKEND_NAMES[backend]}`;
}

export function backendLabel(
  renderer: Renderer,
  backend: StudyBackend | null,
): string {
  if (renderer === 'css' || backend === 'css') return 'css';
  if (backend === null) return `${renderer} · starting`;
  const name = BACKEND_NAMES[backend];
  return renderer === 'three-tsl' && backend === 'webgl2'
    ? `${renderer} · ${name} fallback`
    : `${renderer} · ${name}`;
}
