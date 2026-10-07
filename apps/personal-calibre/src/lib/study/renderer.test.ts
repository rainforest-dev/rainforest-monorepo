import { describe, expect, it } from 'vitest';

import { DEFAULT_PREFS } from '@/lib/prefs';

import {
  backendLabel,
  ENABLED_RENDERERS,
  isThreeRenderer,
  pickRenderer,
  PREVIEW_RENDERERS,
  RENDERER_LABELS,
  rendererLabel,
} from './renderer';

const FINAL = { enabled: ['three-tsl', 'css'], preview: [] } as const;
const INTERIM = { enabled: ['css'], preview: ['three-tsl'] } as const;

describe('pickRenderer', () => {
  it('defaults to three-tsl once it is enabled', () => {
    expect(
      pickRenderer({
        param: null,
        pref: DEFAULT_PREFS.renderer,
        sessionFallback: false,
        ...FINAL,
      }),
    ).toBe('three-tsl');
  });

  it('defaults to css while three-tsl is preview only', () => {
    expect(
      pickRenderer({
        param: null,
        pref: DEFAULT_PREFS.renderer,
        sessionFallback: false,
        ...INTERIM,
      }),
    ).toBe('css');
  });

  it('ships three-tsl as the default with three-glsl and css as alternatives', () => {
    expect(ENABLED_RENDERERS).toEqual(['three-tsl', 'three-glsl', 'css']);
    expect(PREVIEW_RENDERERS).toEqual(['three-pathtrace']);
    expect(
      pickRenderer({
        param: null,
        pref: DEFAULT_PREFS.renderer,
        sessionFallback: false,
      }),
    ).toBe('three-tsl');
    expect(
      pickRenderer({ param: null, pref: 'css', sessionFallback: false }),
    ).toBe('css');
    expect(
      pickRenderer({ param: 'three-tsl', pref: 'css', sessionFallback: false }),
    ).toBe('three-tsl');
  });

  it('honours three-glsl from the cookie and from ?renderer=', () => {
    expect(
      pickRenderer({ param: null, pref: 'three-glsl', sessionFallback: false }),
    ).toBe('three-glsl');
    expect(
      pickRenderer({
        param: 'three-glsl',
        pref: 'css',
        sessionFallback: false,
      }),
    ).toBe('three-glsl');
    expect(
      pickRenderer({
        param: 'css',
        pref: 'three-glsl',
        sessionFallback: false,
      }),
    ).toBe('css');
    expect(
      pickRenderer({
        param: 'three-glsl',
        pref: 'three-glsl',
        sessionFallback: true,
      }),
    ).toBe('css');
  });

  it('lets ?renderer=css override the cookie', () => {
    expect(
      pickRenderer({
        param: 'css',
        pref: 'three-tsl',
        sessionFallback: false,
        ...FINAL,
      }),
    ).toBe('css');
  });

  it('honours a preview-only renderer from ?renderer=', () => {
    expect(
      pickRenderer({
        param: 'three-tsl',
        pref: 'css',
        sessionFallback: false,
        ...INTERIM,
      }),
    ).toBe('three-tsl');
  });

  it('ignores ?renderer= values that are neither enabled nor preview', () => {
    for (const param of ['three-glsl', 'nope', '']) {
      expect(
        pickRenderer({ param, pref: 'css', sessionFallback: false, ...FINAL }),
      ).toBe('css');
      expect(
        pickRenderer({
          param,
          pref: 'three-tsl',
          sessionFallback: false,
          ...FINAL,
        }),
      ).toBe('three-tsl');
      expect(
        pickRenderer({
          param,
          pref: 'css',
          sessionFallback: false,
          ...INTERIM,
        }),
      ).toBe('css');
    }
  });

  it('ignores a cookie naming a preview-only renderer', () => {
    expect(
      pickRenderer({
        param: null,
        pref: 'three-tsl',
        sessionFallback: false,
        ...INTERIM,
      }),
    ).toBe('css');
  });

  it('ignores a cookie naming a renderer in neither list', () => {
    expect(
      pickRenderer({
        param: null,
        pref: 'three-glsl',
        sessionFallback: false,
        ...FINAL,
      }),
    ).toBe('three-tsl');
  });

  it('honours an enabled renderer from the cookie', () => {
    expect(
      pickRenderer({
        param: null,
        pref: 'css',
        sessionFallback: false,
        ...FINAL,
      }),
    ).toBe('css');
  });

  it('returns css for the session fallback whatever the param and cookie say', () => {
    for (const lists of [FINAL, INTERIM]) {
      expect(
        pickRenderer({
          param: 'three-tsl',
          pref: 'three-tsl',
          sessionFallback: true,
          ...lists,
        }),
      ).toBe('css');
    }
  });
});

describe('spike renderers', () => {
  it('honours each spike renderer from ?renderer= on desktop', () => {
    for (const param of PREVIEW_RENDERERS) {
      expect(
        pickRenderer({ param, pref: 'three-tsl', sessionFallback: false }),
      ).toBe(param);
    }
  });

  it('falls back to three-tsl for a spike renderer off desktop', () => {
    for (const param of PREVIEW_RENDERERS) {
      expect(
        pickRenderer({
          param,
          pref: 'css',
          sessionFallback: false,
          desktop: false,
        }),
      ).toBe('three-tsl');
    }
  });

  it('keeps enabled renderers on phones', () => {
    expect(
      pickRenderer({
        param: 'three-glsl',
        pref: 'three-tsl',
        sessionFallback: false,
        desktop: false,
      }),
    ).toBe('three-glsl');
  });

  it('never resolves a spike renderer from the cookie', () => {
    for (const pref of PREVIEW_RENDERERS) {
      expect(pickRenderer({ param: null, pref, sessionFallback: false })).toBe(
        'three-tsl',
      );
    }
  });

  it('is never offered in the renderer select', () => {
    for (const renderer of PREVIEW_RENDERERS) {
      expect(ENABLED_RENDERERS).not.toContain(renderer);
    }
  });

  it('labels three-pathtrace on WebGL2 as a fallback', () => {
    expect(backendLabel('three-pathtrace', 'webgl2')).toBe(
      'three-pathtrace · WebGL2 fallback',
    );
  });
});

describe('isThreeRenderer', () => {
  it('is true for the three.js renderers only', () => {
    expect(isThreeRenderer('three-tsl')).toBe(true);
    expect(isThreeRenderer('three-glsl')).toBe(true);
    expect(isThreeRenderer('css')).toBe(false);
  });
});

describe('labels', () => {
  it('names each renderer for the select', () => {
    expect(RENDERER_LABELS).toEqual({
      'three-tsl': 'three.js · TSL',
      css: 'CSS',
      'three-glsl': 'three.js · GLSL',
      'three-pathtrace': 'three.js · TSL · path traced still',
    });
  });

  it('appends the live backend to the select trigger', () => {
    const cases = [
      ['three-tsl', 'webgpu', 'three.js · TSL · WebGPU'],
      ['three-tsl', 'webgl2', 'three.js · TSL · WebGL2'],
      ['three-tsl', 'css', 'three.js · TSL'],
      ['three-tsl', null, 'three.js · TSL'],
      ['three-glsl', 'webgpu', 'three.js · GLSL · WebGPU'],
      ['three-glsl', 'webgl2', 'three.js · GLSL · WebGL2'],
      ['three-glsl', 'css', 'three.js · GLSL'],
      ['three-glsl', null, 'three.js · GLSL'],
      ['css', 'webgpu', 'CSS'],
      ['css', 'webgl2', 'CSS'],
      ['css', 'css', 'CSS'],
      ['css', null, 'CSS'],
    ] as const;
    for (const [renderer, backend, label] of cases) {
      expect(rendererLabel(renderer, backend)).toBe(label);
    }
  });

  it('never names WebGPU while three-tsl runs on WebGL2', () => {
    expect(rendererLabel('three-tsl', 'webgl2')).not.toContain('WebGPU');
  });

  it('names the renderer and backend for the debug badge', () => {
    expect(backendLabel('three-tsl', 'webgpu')).toBe('three-tsl · WebGPU');
    expect(backendLabel('three-tsl', 'webgl2')).toBe(
      'three-tsl · WebGL2 fallback',
    );
    expect(backendLabel('three-glsl', 'webgl2')).toBe('three-glsl · WebGL2');
    expect(backendLabel('css', 'css')).toBe('css');
    expect(backendLabel('three-tsl', 'css')).toBe('css');
    expect(backendLabel('three-tsl', null)).toBe('three-tsl · starting');
  });
});
