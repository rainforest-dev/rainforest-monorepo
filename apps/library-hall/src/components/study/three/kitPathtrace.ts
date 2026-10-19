import type { WebGPURenderer } from 'three/webgpu';
import {
  OIDNDenoiser,
  type SampleCounts,
  WebGPUPathTracer,
} from 'three-gpu-pathtracer/webgpu';

import type { PhotoOptions, StudyKit } from './kit';
import { kit as tslKit } from './kitTsl';
import {
  createPhotoRunner,
  type PhotoTracer,
  trackMaterials,
} from './photoScene';

export const DENOISER_WEIGHTS_URL = '/oidn/rt_hdr_alb_nrm_small.tza';

const tracked = trackMaterials(tslKit.materials);
const PRESENT_AT_SAMPLES = 8;
const UNDENOISED_SAMPLES = 256;
const MAX_BOUNCES = 4;
const FADE_MS = 250;
const MEASURE_EVERY_FRAMES = 8;

export const PHOTO_DEFAULTS: PhotoOptions = {
  maxSamples: 8,
  renderScale: 1,
  denoise: true,
  frameBudget: 1_000_000,
};

let weights: Promise<boolean> | null = null;
let weightsReady = false;

function checkWeights(): void {
  weights ??= fetch(DENOISER_WEIGHTS_URL, { method: 'HEAD' }).then(
    (response) => {
      weightsReady = response.ok;
      return response.ok;
    },
    () => false,
  );
}

function webGpuTracer(
  gl: WebGPURenderer,
  raster: () => void,
  requested: PhotoOptions,
): PhotoTracer {
  const denoise = requested.denoise && weightsReady;
  const maxSamples =
    requested.denoise && !denoise ? UNDENOISED_SAMPLES : requested.maxSamples;
  const tracer = new WebGPUPathTracer(gl);
  tracer.dynamicLowRes = false;
  tracer.maxBounces = MAX_BOUNCES;
  tracer.renderDelay = 0;
  tracer.fadeDuration = FADE_MS;
  tracer.renderScale = requested.renderScale;
  tracer.frameBudget = requested.frameBudget;
  tracer.maxSamples = maxSamples;
  tracer.minSamples = denoise
    ? maxSamples
    : Math.min(PRESENT_AT_SAMPLES, maxSamples);
  let denoiser: OIDNDenoiser | null = null;
  let counts: SampleCounts | null = null;
  let measuring = false;
  let live = true;
  let frames = 0;
  const measure = () => {
    frames++;
    if (measuring || frames % MEASURE_EVERY_FRAMES !== 0) return;
    measuring = true;
    tracer.getSampleCountsAsync().then(
      (next) => {
        if (live) counts = next;
        measuring = false;
      },
      () => {
        measuring = false;
      },
    );
  };
  const samples = () => counts?.avg ?? 0;
  const presented = () => tracer.fadeState >= 1;
  return {
    load: (scene, camera) => {
      tracer.setScene(scene, camera);
      if (!denoise) return;
      import('oidn-web').then(
        ({ initUNetFromURL }) => {
          if (!live) return;
          denoiser = new OIDNDenoiser({
            initUNetFromURL,
            auxWeightsUrl: DENOISER_WEIGHTS_URL,
          });
          tracer.setDenoiser(denoiser);
        },
        () => undefined,
      );
    },
    sample: () => {
      if (!presented()) raster();
      tracer.renderSample();
      measure();
    },
    samples,
    presented,
    settled: () =>
      presented() && (denoiser ? denoiser.complete : samples() >= maxSamples),
    memoryBytes: () => gl.info.memory.total,
    dispose: () => {
      live = false;
      tracer.dispose();
    },
  };
}

export const kit: StudyKit<WebGPURenderer> = {
  ...tslKit,
  renderer: 'three-pathtrace',
  materials: tracked.materials,
  createPhoto: (gl, scene, camera, report) => {
    if (tslKit.backendOf(gl) !== 'webgpu') return null;
    checkWeights();
    return createPhotoRunner({
      createTracer: (options) =>
        webGpuTracer(gl, () => gl.render(scene, camera), options),
      defaults: PHOTO_DEFAULTS,
      source: scene,
      camera,
      tracked,
      report,
    });
  },
};
