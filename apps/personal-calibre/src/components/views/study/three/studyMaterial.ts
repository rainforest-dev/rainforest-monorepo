import { Color, SRGBColorSpace, Texture } from 'three';
import {
  attribute,
  dot,
  float,
  max,
  mix,
  normalize,
  normalLocal,
  normalWorld,
  select,
  texture,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import { MeshBasicNodeMaterial, MeshLambertNodeMaterial } from 'three/webgpu';

import {
  SPINE_ATTRIBUTES,
  type SpineMaterial,
  type StudyMaterials,
} from './kit';

const SELECTION_MIX = 0.22;
const HIGHLIGHT_MIX = 0.45;

function placeholderTexture(): Texture {
  const texture = new Texture();
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

const light = () =>
  float(0.62).add(
    float(0.38).mul(max(dot(normalWorld, normalize(vec3(0.3, 0.5, 1))), 0)),
  );

export function createStudyMaterials(): StudyMaterials {
  const placeholder = placeholderTexture();
  const spinePlaceholder = placeholderTexture();

  const spine = (): SpineMaterial => {
    const rect = attribute(SPINE_ATTRIBUTES.rect, 'vec4');
    // TextureNode ignores texture.offset/repeat unless updateMatrix is set, so the atlas rect is applied to the UVs here.
    const atlas = texture(placeholder, rect.xy.add(uv().mul(rect.zw)));
    const hasAtlas = uniform(0);
    const selection = uniform(new Color());
    const highlight = uniform(new Color());
    const base = select(
      attribute(SPINE_ATTRIBUTES.spine, 'float')
        .greaterThan(0.5)
        .and(hasAtlas.greaterThan(0.5)),
      atlas.rgb,
      attribute(SPINE_ATTRIBUTES.side, 'vec3'),
    );
    const material = new MeshBasicNodeMaterial();
    material.colorNode = mix(
      mix(
        base.mul(light()),
        selection,
        attribute(SPINE_ATTRIBUTES.selected, 'float').mul(SELECTION_MIX),
      ),
      highlight,
      attribute(SPINE_ATTRIBUTES.highlight, 'float').mul(HIGHLIGHT_MIX),
    );
    return {
      material,
      setAtlas: (next) => {
        atlas.value = next ?? placeholder;
        hasAtlas.value = next ? 1 : 0;
      },
      setHighlight: (color) => {
        highlight.value.copy(color);
      },
      setSelection: (color) => {
        selection.value.copy(color);
      },
    };
  };

  const pulledBook: StudyMaterials['pulledBook'] = () => {
    const cover = texture(placeholder);
    const spineFace = texture(spinePlaceholder);
    const hasCover = uniform(0);
    const side = uniform(new Color());
    const pages = uniform(new Color());
    const material = new MeshLambertNodeMaterial();
    material.colorNode = select(
      normalLocal.x.greaterThan(0.5),
      select(hasCover.greaterThan(0.5), cover.rgb, side.rgb),
      select(
        normalLocal.z.greaterThan(0.5),
        spineFace.rgb,
        select(normalLocal.y.abs().greaterThan(0.5), pages.rgb, side.rgb),
      ),
    );
    return {
      material,
      point: (faces) => {
        cover.value = faces.cover ?? placeholder;
        hasCover.value = faces.cover ? 1 : 0;
        spineFace.value = faces.spine;
        side.value.copy(faces.side);
        pages.value.copy(faces.pages);
      },
    };
  };

  return {
    spine,
    surface: (color) => {
      const material = new MeshLambertNodeMaterial();
      material.color.copy(color);
      return material;
    },
    pulledBook,
    dispose: () => {
      placeholder.dispose();
      spinePlaceholder.dispose();
    },
  };
}
