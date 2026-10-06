import type { AtlasPpu, CameraState, ScreenRect } from '@/lib';

export interface StudyProbe {
  canvasMountAt: number;
  kitLoadMs: number;
  initMs: number;
  firstFrameAt: number | null;
  firstRenderMs: number | null;
  pulledId: number | null;
  floatingId: number | null;
  camera: CameraState | null;
  prewarmedAt: number | null;
  renderMs: number[];
  info: () => StudyProbeInfo;
  projectBook: (bookId: number) => ScreenRect | null;
  projectFront: (bookId: number) => ScreenRect | null;
}

export interface StudyProbeInfo {
  backend: string;
  drawCalls: number;
  triangles: number;
  textures: number;
  texturesSizeReported: number;
  programs: number;
  atlasPpu: AtlasPpu | null;
  coverCacheMax: number | null;
  atlasFits: boolean | null;
  atlasBytes: number;
  atlasBytesEstimated: number;
  textureBytesEstimated: number;
  atlasRows: number;
  atlasOrder: number[];
  rows: number;
  lastAtlasAt: number | null;
  coversCached: number;
  coverCacheBytes: number;
  dpr: number;
}

const PROBE_KEY = '__calibreStudy';

type ProbeWindow = Window & { [PROBE_KEY]?: StudyProbe };

export function publishProbe(probe: StudyProbe): () => void {
  const target = window as ProbeWindow;
  target[PROBE_KEY] = probe;
  return () => {
    if (target[PROBE_KEY] === probe) delete target[PROBE_KEY];
  };
}
