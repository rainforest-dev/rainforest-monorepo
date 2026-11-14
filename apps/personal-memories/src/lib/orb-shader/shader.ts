export const VERTEX = `
attribute vec2 aPos;
varying vec2 vP;
void main() {
  vP = aPos;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT = `
precision mediump float;
varying vec2 vP;
uniform sampler2D uPhoto;
uniform float uHasPhoto;
uniform float uAspect;
uniform vec3 uA;
uniform vec3 uB;
uniform float uTime;
uniform float uDay;
uniform float uSeed;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = vP;
  float r = length(p);
  if (r > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec3 n = vec3(p, z);
  vec3 refr = refract(vec3(0.0, 0.0, -1.0), n, 1.0 / 1.45);
  float t = uTime + uSeed * 37.0;

  vec2 q = p * 0.72 + refr.xy * 0.3;
  vec2 flow = vec2(
    fbm(q * 2.2 + vec2(t * 0.11, -t * 0.07)),
    fbm(q * 2.2 + vec2(-t * 0.09, t * 0.12) + 4.3)
  ) - 0.5;
  q += flow * 0.09;

  vec2 uv = q * 0.5 + 0.5;
  uv.y = 1.0 - uv.y;
  if (uAspect > 1.0) uv.x = (uv.x - 0.5) / uAspect + 0.5;
  else uv.y = (uv.y - 0.5) * uAspect + 0.5;
  vec3 photo = texture2D(uPhoto, clamp(uv, 0.0, 1.0)).rgb;

  float swirl = fbm(p * 1.6 + vec2(cos(t * 0.13), sin(t * 0.1)) * 0.9 + flow * 1.5);
  float side = smoothstep(-0.45, 0.45, (p.x - p.y) * 0.75 + (swirl - 0.5) * 1.4);
  vec3 fog = mix(uA, uB, side);
  float wisps = smoothstep(0.35, 0.8, fbm(p * 2.4 - vec2(t * 0.08, t * 0.05) + side));

  vec3 col;
  if (uHasPhoto > 0.5) {
    col = mix(photo, photo * 0.55 + fog * 0.6, 0.22 + 0.25 * wisps);
  } else {
    col = mix(fog * 0.75, fog * 1.15, wisps);
  }

  float fres = pow(1.0 - z, 2.2);
  col = mix(col, fog * 1.25 + 0.08, fres * 0.75);

  float sparkle = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * 0.21 + fi * 1.9 + uSeed * 6.0), cos(t * 0.17 + fi * 2.6)) * 0.62;
    float tw = 0.5 + 0.5 * sin(t * 1.7 + fi * 3.1);
    sparkle += smoothstep(0.045, 0.0, length(p - c)) * tw;
  }
  col += sparkle * 0.7;

  float spec = smoothstep(0.24, 0.0, length(p - vec2(-0.34, 0.42)));
  float spec2 = smoothstep(0.12, 0.0, length(p - vec2(0.38, -0.5))) * 0.35;
  col += (spec * 0.8 + spec2);

  col *= mix(1.0, 0.5, smoothstep(0.84, 1.0, r));
  col *= mix(0.96, 1.07, uDay);

  float alpha = smoothstep(1.0, 0.975, r);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
}
`;
