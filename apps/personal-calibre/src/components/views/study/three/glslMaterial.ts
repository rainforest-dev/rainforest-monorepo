import {
  Color,
  type IUniform,
  MeshLambertMaterial,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
} from 'three';

import {
  type PulledBookMaterial,
  SPINE_ATTRIBUTES,
  SPINE_LIGHT,
  SPINE_MIX,
  type SpineMaterial,
  type StudyMaterials,
} from './kit';

export const PULLED_BOOK_PROGRAM = 'calibre-pulled-book-glsl';

const glslFloat = (value: number) =>
  Number.isInteger(value) ? value.toFixed(1) : String(value);

const LIGHT_DIR = SPINE_LIGHT.dir.map(glslFloat).join(', ');

export const SPINE_VERTEX = `
attribute float ${SPINE_ATTRIBUTES.spine};
attribute vec4 ${SPINE_ATTRIBUTES.rect};
attribute vec3 ${SPINE_ATTRIBUTES.side};
attribute float ${SPINE_ATTRIBUTES.selected};
attribute float ${SPINE_ATTRIBUTES.highlight};
varying vec2 vAtlasUv;
varying float vSpine;
varying vec3 vCol;
varying float vSel;
varying float vHi;
varying vec3 vNormalWorld;
void main() {
  vAtlasUv = ${SPINE_ATTRIBUTES.rect}.xy + uv * ${SPINE_ATTRIBUTES.rect}.zw;
  vSpine = ${SPINE_ATTRIBUTES.spine};
  vCol = ${SPINE_ATTRIBUTES.side};
  vSel = ${SPINE_ATTRIBUTES.selected};
  vHi = ${SPINE_ATTRIBUTES.highlight};
  vNormalWorld = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const SPINE_FRAGMENT = `
uniform sampler2D uAtlas;
uniform float uHasAtlas;
uniform vec3 uSel;
uniform vec3 uHi;
uniform float uDim;
varying vec2 vAtlasUv;
varying float vSpine;
varying vec3 vCol;
varying float vSel;
varying float vHi;
varying vec3 vNormalWorld;
void main() {
  vec3 atlas = texture2D(uAtlas, vAtlasUv).rgb;
  vec3 base = vSpine > 0.5 && uHasAtlas > 0.5 ? atlas : vCol;
  float light = ${glslFloat(SPINE_LIGHT.base)} + ${glslFloat(SPINE_LIGHT.gain)} * max(dot(normalize(vNormalWorld), normalize(vec3(${LIGHT_DIR}))), 0.0);
  vec3 color = mix(mix(base * light, uSel, vSel * ${glslFloat(SPINE_MIX.selection)}), uHi, vHi * ${glslFloat(SPINE_MIX.highlight)});
  gl_FragColor = vec4(color * (1.0 - uDim), 1.0);
  #include <colorspace_fragment>
}
`;

const UV_ANCHOR = '#include <uv_vertex>';
const MAP_ANCHOR = '#include <map_fragment>';

const PULLED_BOOK_VERTEX_PARS = `
varying vec3 vFaceNormal;
varying vec2 vFaceUv;
`;

const PULLED_BOOK_VERTEX = `
${UV_ANCHOR}
vFaceNormal = normal;
vFaceUv = uv;
`;

const PULLED_BOOK_FRAGMENT_PARS = `
uniform sampler2D uCover;
uniform float uHasCover;
uniform sampler2D uBack;
uniform float uHasBack;
uniform sampler2D uSpineFace;
uniform vec3 uSide;
uniform vec3 uPages;
varying vec3 vFaceNormal;
varying vec2 vFaceUv;
`;

const PULLED_BOOK_FRAGMENT = `
vec3 coverFace = texture2D(uCover, vFaceUv).rgb;
vec3 backFace = texture2D(uBack, vFaceUv).rgb;
vec3 spineFace = texture2D(uSpineFace, vFaceUv).rgb;
diffuseColor.rgb = vFaceNormal.x > 0.5
  ? (uHasCover > 0.5 ? coverFace : uSide)
  : vFaceNormal.x < -0.5
    ? (uHasBack > 0.5 ? backFace : uSide)
    : vFaceNormal.z > 0.5
      ? spineFace
      : abs(vFaceNormal.y) > 0.5 ? uPages : uSide;
`;

function replaceAnchor(source: string, anchor: string, next: string): string {
  if (!source.includes(anchor)) {
    throw new Error(`Pulled-book shader anchor ${anchor} is missing`);
  }
  return source.replace(anchor, next);
}

// The anchors are three's Lambert shader chunk names at three 0.186.1.
export function injectPulledBook(shader: {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
}): void {
  shader.vertexShader =
    PULLED_BOOK_VERTEX_PARS +
    replaceAnchor(shader.vertexShader, UV_ANCHOR, PULLED_BOOK_VERTEX);
  shader.fragmentShader =
    PULLED_BOOK_FRAGMENT_PARS +
    replaceAnchor(shader.fragmentShader, MAP_ANCHOR, PULLED_BOOK_FRAGMENT);
}

function placeholderTexture(): Texture {
  const texture = new Texture();
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createGlslMaterials(): StudyMaterials {
  const placeholder = placeholderTexture();
  const spinePlaceholder = placeholderTexture();
  const backPlaceholder = placeholderTexture();
  const dim: IUniform<number> = { value: 0 };

  const spine = (): SpineMaterial => {
    const atlas: IUniform<Texture> = { value: placeholder };
    const hasAtlas: IUniform<number> = { value: 0 };
    const selection: IUniform<Color> = { value: new Color() };
    const highlight: IUniform<Color> = { value: new Color() };
    const material = new ShaderMaterial({
      vertexShader: SPINE_VERTEX,
      fragmentShader: SPINE_FRAGMENT,
      uniforms: {
        uAtlas: atlas,
        uHasAtlas: hasAtlas,
        uSel: selection,
        uHi: highlight,
        uDim: dim,
      },
    });
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

  const pulledBook = (): PulledBookMaterial => {
    const uniforms = {
      uCover: { value: placeholder } as IUniform<Texture>,
      uHasCover: { value: 0 } as IUniform<number>,
      uBack: { value: backPlaceholder } as IUniform<Texture>,
      uHasBack: { value: 0 } as IUniform<number>,
      uSpineFace: { value: spinePlaceholder } as IUniform<Texture>,
      uSide: { value: new Color() } as IUniform<Color>,
      uPages: { value: new Color() } as IUniform<Color>,
    };
    const material = new MeshLambertMaterial();
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      injectPulledBook(shader);
    };
    material.customProgramCacheKey = () => PULLED_BOOK_PROGRAM;
    return {
      material,
      point: (faces) => {
        uniforms.uCover.value = faces.cover ?? placeholder;
        uniforms.uHasCover.value = faces.cover ? 1 : 0;
        uniforms.uBack.value = faces.back ?? backPlaceholder;
        uniforms.uHasBack.value = faces.back ? 1 : 0;
        uniforms.uSpineFace.value = faces.spine;
        uniforms.uSide.value.copy(faces.side);
        uniforms.uPages.value.copy(faces.pages);
      },
    };
  };

  return {
    spine,
    surface: (color) => {
      const material = new MeshLambertMaterial();
      material.color.copy(color);
      return material;
    },
    pulledBook,
    setDim: (amount) => {
      dim.value = amount;
    },
    dispose: () => {
      placeholder.dispose();
      spinePlaceholder.dispose();
      backPlaceholder.dispose();
    },
  };
}
