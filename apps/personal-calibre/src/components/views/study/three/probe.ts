export interface StudyProbe {
  canvasMountAt: number;
  kitLoadMs: number;
  initMs: number;
  firstFrameAt: number | null;
  firstRenderMs: number | null;
  pulledId: number | null;
  info: () => StudyProbeInfo;
}

export interface StudyProbeInfo {
  backend: string;
  drawCalls: number;
  triangles: number;
  textures: number;
  texturesSizeReported: number;
  programs: number;
  atlasBytes: number;
  coversCached: number;
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
