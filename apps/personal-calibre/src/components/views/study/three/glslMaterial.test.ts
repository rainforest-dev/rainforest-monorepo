import { readFileSync } from 'node:fs';

import {
  CanvasTexture,
  Color,
  type IUniform,
  type Material,
  MeshLambertMaterial,
  ShaderLib,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  UniformsUtils,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import { describe, expect, it } from 'vitest';

import {
  createGlslMaterials,
  injectPulledBook,
  PULLED_BOOK_PROGRAM,
  SPINE_FRAGMENT,
  SPINE_VERTEX,
} from './glslMaterial';
import { SPINE_ATTRIBUTES } from './kit';

type Uniforms = Record<string, IUniform>;

function lambertShader() {
  return {
    vertexShader: ShaderLib.lambert.vertexShader,
    fragmentShader: ShaderLib.lambert.fragmentShader,
    uniforms: UniformsUtils.clone(ShaderLib.lambert.uniforms) as Uniforms,
  };
}

function compiled(material: Material) {
  const shader = lambertShader();
  material.onBeforeCompile(
    shader as WebGLProgramParametersWithUniforms,
    {} as WebGLRenderer,
  );
  return shader;
}

function spineUniforms(material: Material): Uniforms {
  return (material as ShaderMaterial).uniforms;
}

function texturesIn(uniforms: Uniforms): Texture[] {
  return Object.values(uniforms)
    .map((uniform) => uniform.value)
    .filter((value): value is Texture => value instanceof Texture);
}

function faces(seed: number) {
  return {
    cover: seed % 2 === 0 ? new CanvasTexture({} as HTMLCanvasElement) : null,
    back: seed % 3 === 0 ? new CanvasTexture({} as HTMLCanvasElement) : null,
    spine: new CanvasTexture({} as HTMLCanvasElement),
    side: new Color(seed / 10, 0.2, 0.3),
    pages: new Color(0.9, 0.9, seed / 10),
  };
}

describe('spine shaders', () => {
  it('declares every shared spine attribute', () => {
    for (const name of Object.values(SPINE_ATTRIBUTES)) {
      expect(SPINE_VERTEX).toMatch(
        new RegExp(`attribute (float|vec3|vec4) ${name};`),
      );
    }
  });

  it('reads its uniforms and converts to the output colour space', () => {
    for (const name of ['uAtlas', 'uHasAtlas', 'uSel', 'uHi', 'uDim']) {
      expect(SPINE_FRAGMENT).toContain(` ${name};`);
    }
    expect(SPINE_FRAGMENT).toContain('#include <colorspace_fragment>');
    expect(SPINE_FRAGMENT).not.toContain('tonemapping');
  });

  it('takes the spine mixes and light term from the kit constants', () => {
    const source = readFileSync(
      new URL('./glslMaterial.ts', import.meta.url),
      'utf8',
    );
    for (const literal of ['0.22', '0.45', '0.62', '0.38']) {
      expect(source).not.toContain(literal);
      expect(SPINE_FRAGMENT).toContain(literal);
    }
  });
});

describe('createGlslMaterials', () => {
  it('builds every spine material from one source and one dim uniform', () => {
    const materials = createGlslMaterials();
    const a = materials.spine().material as ShaderMaterial;
    const b = materials.spine().material as ShaderMaterial;

    expect(a).not.toBe(b);
    expect(a).toBeInstanceOf(ShaderMaterial);
    expect(a.vertexShader).toBe(SPINE_VERTEX);
    expect(b.vertexShader).toBe(SPINE_VERTEX);
    expect(a.fragmentShader).toBe(SPINE_FRAGMENT);
    expect(b.fragmentShader).toBe(SPINE_FRAGMENT);
    expect(a.uniforms.uDim).toBe(b.uniforms.uDim);

    materials.setDim(0.55);
    expect(a.uniforms.uDim.value).toBe(0.55);
    expect(b.uniforms.uDim.value).toBe(0.55);
  });

  it('changes spine colours and the atlas through values only', () => {
    const { material, setAtlas, setHighlight, setSelection } =
      createGlslMaterials().spine();
    const uniforms = spineUniforms(material);
    const placeholder = uniforms.uAtlas.value as Texture;
    const version = material.version;
    const atlas = new CanvasTexture({} as HTMLCanvasElement);

    expect(uniforms.uHasAtlas.value).toBe(0);
    setHighlight(new Color(1, 0, 0));
    setSelection(new Color(0, 0, 1));
    setAtlas(atlas);

    expect(uniforms.uHi.value).toEqual(new Color(1, 0, 0));
    expect(uniforms.uSel.value).toEqual(new Color(0, 0, 1));
    expect(uniforms.uAtlas.value).toBe(atlas);
    expect(uniforms.uHasAtlas.value).toBe(1);

    setAtlas(null);

    expect(uniforms.uAtlas.value).toBe(placeholder);
    expect(uniforms.uHasAtlas.value).toBe(0);
    expect(material.version).toBe(version);
  });

  it('shares one program between pulled-book materials', () => {
    const materials = createGlslMaterials();
    const a = materials.pulledBook().material;
    const b = materials.pulledBook().material;

    expect(a).not.toBe(b);
    expect(a).toBeInstanceOf(MeshLambertMaterial);
    expect(a.customProgramCacheKey()).toBe(PULLED_BOOK_PROGRAM);
    expect(b.customProgramCacheKey()).toBe(PULLED_BOOK_PROGRAM);

    const left = compiled(a);
    const right = compiled(b);
    expect(left.vertexShader).toBe(right.vertexShader);
    expect(left.fragmentShader).toBe(right.fragmentShader);
    expect(left.uniforms.uCover).not.toBe(right.uniforms.uCover);
  });

  it('re-points one pulled-book material through uniform values', () => {
    const materials = createGlslMaterials();
    const { material, point } = materials.pulledBook();
    const { uniforms } = compiled(material);
    const coverPlaceholder = uniforms.uCover.value;
    const backPlaceholder = uniforms.uBack.value;
    const version = material.version;

    const first = faces(6);
    point(first);
    expect(uniforms.uCover.value).toBe(first.cover);
    expect(uniforms.uHasCover.value).toBe(1);
    expect(uniforms.uBack.value).toBe(first.back);
    expect(uniforms.uHasBack.value).toBe(1);
    expect(uniforms.uSpineFace.value).toBe(first.spine);
    expect(uniforms.uSide.value).toEqual(first.side);
    expect(uniforms.uPages.value).toEqual(first.pages);

    const second = faces(1);
    point(second);
    expect(uniforms.uCover.value).toBe(coverPlaceholder);
    expect(uniforms.uHasCover.value).toBe(0);
    expect(uniforms.uBack.value).toBe(backPlaceholder);
    expect(uniforms.uHasBack.value).toBe(0);
    expect(uniforms.uSpineFace.value).toBe(second.spine);

    expect(material.version).toBe(version);
    expect((material as MeshLambertMaterial).map).toBeNull();
  });

  it('starts the pulled-book cover, back and spine on different sRGB textures', () => {
    const materials = createGlslMaterials();
    const { uniforms } = compiled(materials.pulledBook().material);
    const textures = [
      uniforms.uCover.value,
      uniforms.uBack.value,
      uniforms.uSpineFace.value,
    ];

    expect(new Set(textures).size).toBe(3);
    for (const texture of [
      ...textures,
      spineUniforms(materials.spine().material).uAtlas.value,
    ]) {
      expect(texture).toBeInstanceOf(Texture);
      expect((texture as Texture).colorSpace).toBe(SRGBColorSpace);
    }
  });

  it('leaves tone mapping to the renderer and texture transforms unused', () => {
    const materials = createGlslMaterials();
    const spine = materials.spine();
    const pulled = materials.pulledBook();
    const { uniforms } = compiled(pulled.material);
    spine.setAtlas(new CanvasTexture({} as HTMLCanvasElement));
    pulled.point(faces(6));
    const surface = materials.surface(new Color(0.5, 0.25, 0.125));

    expect(surface).toBeInstanceOf(MeshLambertMaterial);
    expect((surface as MeshLambertMaterial).color).toEqual(
      new Color(0.5, 0.25, 0.125),
    );
    for (const material of [spine.material, pulled.material, surface]) {
      expect(material.toneMapped).toBe(true);
    }
    for (const texture of [
      ...texturesIn(spineUniforms(spine.material)),
      ...texturesIn(uniforms),
    ]) {
      expect(texture.offset.toArray()).toEqual([0, 0]);
      expect(texture.repeat.toArray()).toEqual([1, 1]);
    }
  });

  it('frees its three placeholders on dispose', () => {
    const materials = createGlslMaterials();
    const { uniforms } = compiled(materials.pulledBook().material);
    const placeholders = new Set([
      spineUniforms(materials.spine().material).uAtlas.value as Texture,
      uniforms.uCover.value as Texture,
      uniforms.uBack.value as Texture,
      uniforms.uSpineFace.value as Texture,
    ]);
    const disposed = new Set<Texture>();
    for (const texture of placeholders) {
      texture.addEventListener('dispose', () => disposed.add(texture));
    }

    materials.dispose();

    expect(placeholders.size).toBe(3);
    expect(disposed).toEqual(placeholders);
  });
});

describe('injectPulledBook', () => {
  it("rewrites three's Lambert shader at its uv and map anchors", () => {
    const shader = lambertShader();
    injectPulledBook(shader);

    expect(shader.vertexShader).toContain('#include <uv_vertex>');
    expect(shader.vertexShader).toContain('vFaceNormal = normal;');
    expect(shader.vertexShader).toContain('vFaceUv = uv;');
    expect(shader.fragmentShader).not.toContain('#include <map_fragment>');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb =');
    for (const name of [
      'uCover',
      'uHasCover',
      'uBack',
      'uHasBack',
      'uSpineFace',
      'uSide',
      'uPages',
    ]) {
      expect(shader.fragmentShader).toContain(` ${name};`);
    }
  });

  it('fails loudly when an anchor is missing', () => {
    const noUv = lambertShader();
    noUv.vertexShader = noUv.vertexShader.replace('#include <uv_vertex>', '');
    expect(() => injectPulledBook(noUv)).toThrow('uv_vertex');

    const noMap = lambertShader();
    noMap.fragmentShader = noMap.fragmentShader.replace(
      '#include <map_fragment>',
      '',
    );
    expect(() => injectPulledBook(noMap)).toThrow('map_fragment');
  });
});
