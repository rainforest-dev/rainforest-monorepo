import {
  approach,
  FRAGMENT,
  FRAME_MS,
  hexToRgb,
  resolveColor,
  seedOf,
  VERTEX,
} from '@/lib/orb-shader';

type OrbState = {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  seed: number;
  speed: number;
  time: number;
  hover: boolean;
};

const SLOW = 0.35;
const FAST = 1.6;
const REDUCE = '(prefers-reduced-motion: reduce)';

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader) ?? 'compile');
  return shader;
}

function program(gl: WebGLRenderingContext) {
  const prog = gl.createProgram();
  if (!prog) throw new Error('program');
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  return prog;
}

export function startOrbShader() {
  if (matchMedia(REDUCE).matches) return;
  const orbs = [
    ...document.querySelectorAll<HTMLElement>('[data-orb][data-shader-a]'),
  ];
  if (orbs.length === 0) return;

  const glCanvas = document.createElement('canvas');
  const gl = glCanvas.getContext('webgl', {
    premultipliedAlpha: true,
    alpha: true,
    antialias: false,
  });
  if (!gl) return;

  let prog: WebGLProgram;
  try {
    prog = program(gl);
  } catch (error) {
    console.warn('[orbs] shader unavailable, keeping CSS orbs', error);
    return;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(prog, name);
  const loc = {
    photo: u('uPhoto'),
    hasPhoto: u('uHasPhoto'),
    aspect: u('uAspect'),
    a: u('uA'),
    b: u('uB'),
    time: u('uTime'),
    day: u('uDay'),
    seed: u('uSeed'),
  };
  gl.uniform1i(loc.photo, 0);

  const blank = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, blank);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 255]),
  );

  const textures = new Map<
    string,
    { tex: WebGLTexture; aspect: number } | 'loading'
  >();
  const texture = (url: string) => {
    const hit = textures.get(url);
    if (hit) return hit === 'loading' ? undefined : hit;
    textures.set(url, 'loading');
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const tex = gl.createTexture();
      if (!tex) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      textures.set(url, {
        tex,
        aspect: img.naturalWidth / Math.max(1, img.naturalHeight),
      });
    };
    img.onerror = () => textures.delete(url);
    img.src = url;
    return undefined;
  };

  const states = new Map<HTMLElement, OrbState>();
  for (const el of orbs) {
    const canvas = el.querySelector<HTMLCanvasElement>('[data-orb-canvas]');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) continue;
    const state: OrbState = {
      el,
      canvas,
      ctx,
      seed: seedOf(
        el.closest('a')?.getAttribute('href') ??
          el.dataset['shaderPhoto'] ??
          '',
      ),
      speed: SLOW,
      time: 0,
      hover: false,
    };
    const host = el.closest('a') ?? el;
    host.addEventListener('pointerenter', () => (state.hover = true));
    host.addEventListener('pointerleave', () => (state.hover = false));
    host.addEventListener('focusin', () => (state.hover = true));
    host.addEventListener('focusout', () => (state.hover = false));
    states.set(el, state);
  }

  const visible = new Set<OrbState>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const state = states.get(entry.target as HTMLElement);
        if (!state) continue;
        if (entry.isIntersecting) visible.add(state);
        else visible.delete(state);
      }
    },
    { rootMargin: '64px' },
  );
  for (const el of states.keys()) io.observe(el);

  const root = document.documentElement;
  const colour = (value: string | undefined) =>
    hexToRgb(resolveColor(value ?? '', root)) ?? [0.6, 0.6, 0.7];
  const phone = matchMedia('(pointer: coarse), (max-width: 640px)');

  let lost = false;
  glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    for (const s of states.values()) {
      s.el.removeAttribute('data-gl');
      s.canvas.hidden = true;
    }
  });

  const dpr = Math.min(2, devicePixelRatio || 1);
  let last = 0;
  let frames = 0;
  let fpsStart = performance.now();
  const stats = { fps: 0, orbs: 0, workMs: 0 };
  let work = 0;
  (window as unknown as { __orbShader: typeof stats }).__orbShader = stats;

  const frame = (now: number) => {
    if (lost) return;
    requestAnimationFrame(frame);
    if (document.hidden || visible.size === 0) return;
    const budget = phone.matches ? FRAME_MS.phone : FRAME_MS.desktop;
    if (now - last < budget - 8) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    frames++;
    if (now - fpsStart >= 1000) {
      stats.fps = Math.round((frames * 1000) / (now - fpsStart));
      stats.orbs = visible.size;
      stats.workMs = Math.round((work / frames) * 100) / 100;
      work = 0;
      frames = 0;
      fpsStart = now;
    }
    const t0 = performance.now();
    const day = root.dataset['ioTheme'] === 'day' ? 1 : 0;
    gl.uniform1f(loc.day, day);

    for (const s of visible) {
      const size = Math.round(s.el.clientWidth * dpr);
      if (size === 0) continue;
      if (glCanvas.width < size || glCanvas.height < size) {
        glCanvas.width = Math.max(glCanvas.width, size);
        glCanvas.height = Math.max(glCanvas.height, size);
      }
      if (s.canvas.width !== size) {
        s.canvas.width = size;
        s.canvas.height = size;
      }
      s.speed = approach(s.speed, s.hover ? FAST : SLOW, dt);
      s.time += dt * s.speed;
      const photoUrl = s.el.dataset['shaderPhoto'];
      const tex = photoUrl ? texture(photoUrl) : undefined;
      if (photoUrl && !tex) continue;

      gl.viewport(0, glCanvas.height - size, size, size);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex?.tex ?? blank);
      gl.uniform1f(loc.hasPhoto, tex ? 1 : 0);
      gl.uniform1f(loc.aspect, tex?.aspect ?? 1);
      gl.uniform3fv(loc.a, colour(s.el.dataset['shaderA']));
      gl.uniform3fv(loc.b, colour(s.el.dataset['shaderB']));
      gl.uniform1f(loc.seed, s.seed);
      gl.uniform1f(loc.time, s.time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      s.ctx.clearRect(0, 0, size, size);
      s.ctx.drawImage(glCanvas, 0, 0, size, size, 0, 0, size, size);
      if (!s.el.hasAttribute('data-gl')) {
        s.canvas.hidden = false;
        s.el.setAttribute('data-gl', '');
      }
    }
    work += performance.now() - t0;
  };
  requestAnimationFrame(frame);
}
