import { readFileSync } from 'node:fs';

import {
  CanvasTexture,
  Color,
  type Material,
  SRGBColorSpace,
  Texture,
} from 'three';
import { NodeMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { SPINE_ATTRIBUTES, SPINE_LIGHT, SPINE_MIX } from './kit';
import { kit } from './kitTsl';
import { createStudyMaterials } from './studyMaterial';

function cacheKey(material: Material): string {
  return (material as NodeMaterial).customProgramCacheKey();
}

const IDENTITY_FIELDS = new Set(['id', 'uuid', 'version', '_cacheKey']);

function graphShape(node: unknown): string {
  if (!node || typeof node !== 'object') return String(node);
  const fields = Object.entries(node)
    .filter(
      ([name, value]) =>
        !IDENTITY_FIELDS.has(name) &&
        !name.startsWith('_cacheKey') &&
        ['string', 'number', 'boolean'].includes(typeof value),
    )
    .map(([name, value]) => `${name}=${String(value)}`);
  const children = [
    ...(node as { getChildren: () => Iterable<unknown> }).getChildren(),
  ].map(graphShape);
  return `${node.constructor.name}{${fields.join(',')}}(${children.join(',')})`;
}

function texturesOf(material: Material): Texture[] {
  const found = new Set<Texture>();
  const visit = (node: unknown, seen: Set<unknown>) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const value = (node as { value?: unknown }).value;
    if (value instanceof Texture) found.add(value);
    for (const child of Object.values(node)) visit(child, seen);
  };
  visit((material as NodeMaterial).colorNode, new Set());
  return [...found];
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

describe('createStudyMaterials', () => {
  it('names the shared spine attributes', () => {
    expect(SPINE_ATTRIBUTES).toEqual({
      spine: 'aSpine',
      rect: 'aRect',
      side: 'aCol',
      selected: 'aSel',
      highlight: 'aHi',
    });
  });

  it('builds every spine material from the same node graph', () => {
    const materials = createStudyMaterials();
    const a = materials.spine().material as NodeMaterial;
    const b = materials.spine().material as NodeMaterial;
    expect(a).not.toBe(b);
    expect(graphShape(a.colorNode)).toBe(graphShape(b.colorNode));
    expect(graphShape(a.colorNode)).toContain('TextureNode');
  });

  it('changes spine colours and the atlas through values only', () => {
    const { material, setAtlas, setHighlight, setSelection } =
      createStudyMaterials().spine();
    const key = cacheKey(material);
    const version = material.version;
    const colorNode = (material as NodeMaterial).colorNode;

    setHighlight(new Color(1, 0, 0));
    setSelection(new Color(0, 0, 1));
    setAtlas(new CanvasTexture({} as HTMLCanvasElement));
    setAtlas(null);

    expect(material.version).toBe(version);
    expect((material as NodeMaterial).colorNode).toBe(colorNode);
    expect(cacheKey(material)).toBe(key);
  });

  it('re-points one pulled-book material without rebuilding it', () => {
    const { material, point } = createStudyMaterials().pulledBook();
    const colorNode = (material as NodeMaterial).colorNode;
    point(faces(2));
    const key = cacheKey(material);
    const version = material.version;

    point(faces(3));
    point(faces(4));

    expect(material.version).toBe(version);
    expect((material as NodeMaterial).colorNode).toBe(colorNode);
    expect(cacheKey(material)).toBe(key);
  });

  it('starts the pulled-book cover, back and spine on different textures', () => {
    const { material } = createStudyMaterials().pulledBook();
    expect(texturesOf(material)).toHaveLength(3);
  });

  it('dims every spine through one shared value', () => {
    const materials = createStudyMaterials();
    const a = materials.spine().material;
    const b = materials.spine().material;
    const keys = [cacheKey(a), cacheKey(b)];
    const versions = [a.version, b.version];

    materials.setDim(0.55);
    materials.setDim(0);

    expect([cacheKey(a), cacheKey(b)]).toEqual(keys);
    expect([a.version, b.version]).toEqual(versions);
  });

  it('starts every placeholder in sRGB, like the atlases and covers', () => {
    const materials = createStudyMaterials();
    const placeholders = [
      ...texturesOf(materials.spine().material),
      ...texturesOf(materials.pulledBook().material),
    ];
    expect(placeholders.length).toBeGreaterThan(0);
    for (const texture of placeholders) {
      expect(texture.colorSpace).toBe(SRGBColorSpace);
    }
  });

  it('leaves tone mapping to the renderer and texture transforms unused', () => {
    const materials = createStudyMaterials();
    const spine = materials.spine();
    const pulled = materials.pulledBook();
    const atlas = new CanvasTexture({} as HTMLCanvasElement);
    spine.setAtlas(atlas);
    pulled.point(faces(2));
    const all = [
      spine.material,
      pulled.material,
      materials.surface(new Color(0.5, 0.5, 0.5)),
    ];

    for (const material of all) {
      expect(material.toneMapped).toBe(true);
      for (const texture of texturesOf(material)) {
        expect(texture.offset.toArray()).toEqual([0, 0]);
        expect(texture.repeat.toArray()).toEqual([1, 1]);
      }
    }
    expect(texturesOf(spine.material)).toContain(atlas);
  });
});

describe('the TSL kit', () => {
  it('fits the renderer-neutral kit contract', () => {
    expect(kit.renderer).toBe('three-tsl');
    expect(kit.reportedTargetBuffers).toBe(2);
  });

  it('takes the spine mixes and light term from the kit constants', () => {
    expect(SPINE_MIX).toEqual({ selection: 0.22, highlight: 0.45 });
    expect(SPINE_LIGHT).toEqual({ base: 0.62, gain: 0.38, dir: [0.3, 0.5, 1] });
    const source = readFileSync(
      new URL('./studyMaterial.ts', import.meta.url),
      'utf8',
    );
    for (const literal of ['0.22', '0.45', '0.62', '0.38']) {
      expect(source).not.toContain(literal);
    }
  });
});
