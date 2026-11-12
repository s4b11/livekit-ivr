/**
 * The Aura audio visualizer, as used by the assistant widget (web/public/embed/embed.js):
 * the same shader, uniform values and per-state animations as LiveKit Agents UI's
 * AgentAudioVisualizerAura, rendered with plain WebGL.
 *
 * The shader was originally developed for Unicorn Studio (https://unicorn.studio),
 * © 2026 UNCRN LLC, licensed under the Polyform Non-Resale License 1.0.0.
 */

export type AuraState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface Aura {
  setState(state: AuraState): void;
  /** Voice level, 0 to 1. Only used while speaking. */
  setVolume(volume: number): void;
  play(): void;
  pause(): void;
}

const SHADER = `
const float TAU = 6.283185;
vec2 randFibo(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.xx + p.yx) * p.xy); }
vec3 Tonemap(vec3 x) { x *= 4.0; return x / (1.0 + x); }
float luma(vec3 color) { return dot(color, vec3(0.299, 0.587, 0.114)); }
vec3 rgb2hsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
float sdCircle(vec2 st, float r) { return length(st) - r; }
float sdLine(vec2 p, float r) { float halfLen = r * 2.0; vec2 a = vec2(-halfLen, 0.0); vec2 b = vec2(halfLen, 0.0); vec2 pa = p - a; vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float getSdf(vec2 st) { if (uShape == 1.0) return sdCircle(st, uScale); else if (uShape == 2.0) return sdLine(st, uScale); return sdCircle(st, uScale); }
vec2 turb(vec2 pos, float t, float it) {
  mat2 rotation = mat2(0.6, -0.25, 0.25, 0.9); mat2 layerRotation = mat2(0.6, -0.8, 0.8, 0.6);
  float frequency = mix(2.0, 15.0, uFrequency); float amplitude = uAmplitude; float frequencyGrowth = 1.4;
  float animTime = t * 0.1 * uSpeed;
  const int LAYERS = 4;
  for (int i = 0; i < LAYERS; i++) {
    vec2 rotatedPos = pos * rotation; vec2 wave = sin(frequency * rotatedPos + float(i) * animTime + it);
    pos += (amplitude / frequency) * rotation[0] * wave;
    rotation *= layerRotation; amplitude *= mix(1.0, max(wave.x, wave.y), uVariance); frequency *= frequencyGrowth;
  }
  return pos;
}
const float ITERATIONS = 36.0;
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy; vec3 pp = vec3(0.0); vec3 bloom = vec3(0.0); float t = iTime * 0.5; vec2 pos = uv - 0.5;
  vec2 prevPos = turb(pos, t, 0.0 - 1.0 / ITERATIONS); float spacing = mix(1.0, TAU, uSpacing);
  for (float i = 1.0; i < ITERATIONS + 1.0; i++) {
    float iter = i / ITERATIONS; vec2 st = turb(pos, t, iter * spacing); float d = abs(getSdf(st)); float pd = distance(st, prevPos); prevPos = st;
    float dynamicBlur = exp2(pd * 2.0 * 1.4426950408889634) - 1.0;
    float ds = smoothstep(0.0, uBlur * 0.05 + max(dynamicBlur * uSmoothing, 0.001), d);
    vec3 color = uColor;
    if (uColorShift > 0.01) { vec3 hsv = rgb2hsv(color); hsv.x = fract(hsv.x + (1.0 - iter) * uColorShift * 0.3); color = hsv2rgb(hsv); }
    float invd = 1.0 / max(d + dynamicBlur, 0.001); pp += (ds - 1.0) * color; bloom += clamp(invd, 0.0, 250.0) * color;
  }
  pp *= 1.0 / ITERATIONS;
  vec3 color;
  if (uMode < 0.5) {
    bloom = bloom / (bloom + 2e4); color = (-pp + bloom * 3.0 * uBloom) * 1.2; color += (randFibo(fragCoord).x - 0.5) / 255.0;
    color = Tonemap(color); float alpha = luma(color) * uMix; fragColor = vec4(color * uMix, alpha);
  } else {
    color = -pp; color += (randFibo(fragCoord).x - 0.5) / 255.0;
    float brightness = length(color); vec3 direction = brightness > 0.0 ? color / brightness : color;
    float factor = 2.0; float mappedBrightness = (brightness * factor) / (1.0 + brightness * factor); color = direction * mappedBrightness;
    float gray = dot(color, vec3(0.2, 0.5, 0.1)); float saturationBoost = 3.0; color = mix(vec3(gray), color, saturationBoost);
    color = clamp(color, 0.0, 1.0); float alpha = mappedBrightness * clamp(uMix, 1.0, 2.0); fragColor = vec4(color, alpha);
  }
}
`;

const UNIFORMS = [
  'iResolution', 'iTime', 'uSpeed', 'uBlur', 'uScale', 'uShape', 'uFrequency', 'uAmplitude',
  'uBloom', 'uMix', 'uSpacing', 'uColorShift', 'uVariance', 'uSmoothing', 'uMode', 'uColor',
] as const;

/** motion's "easeOut": cubic-bezier(0, 0, 0.58, 1). */
function easeOut(x: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    if (3 * (1 - t) * t * t * 0.58 + t * t * t < x) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return 3 * (1 - t) * t * t + t * t * t;
}

/** One animated number: eased tweens, a mirrored pulse, and a spring. */
function animated(initial: number) {
  let v = initial;
  let mode: 'idle' | 'tween' | 'pulse' | 'spring' = 'idle';
  let from = 0, to = 0, start = 0, duration = 0, a = 0, b = 0;
  return {
    tween(target: number, ms: number, now: number) { mode = 'tween'; from = v; to = target; start = now; duration = ms; },
    pulse(lo: number, hi: number, ms: number, now: number) { mode = 'pulse'; a = lo; b = hi; start = now; duration = ms; },
    spring(target: number, now: number) { mode = 'spring'; from = v; to = target; start = now; },
    set(x: number) { mode = 'idle'; v = x; },
    isAnimating(now: number) {
      if (mode === 'tween') return now - start < duration;
      if (mode === 'spring') return now - start < 1200;
      return mode === 'pulse';
    },
    step(now: number) {
      if (mode === 'tween') {
        const t = Math.min(1, (now - start) / duration);
        v = from + (to - from) * easeOut(t);
        if (t >= 1) mode = 'idle';
      } else if (mode === 'pulse') {
        const cycle = (now - start) / duration;
        const n = Math.floor(cycle);
        const p = cycle - n;
        v = a + (b - a) * (n % 2 === 0 ? easeOut(p) : easeOut(1 - p));
      } else if (mode === 'spring') {
        const t = (now - start) / 1000;
        const zeta = 0.65;
        const w0 = (2 * Math.PI) / 0.95;
        const wd = w0 * Math.sqrt(1 - zeta * zeta);
        const x = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
        v = from + (to - from) * x;
        if (t >= 1.2) { v = to; mode = 'idle'; }
      }
      return v;
    },
  };
}

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}

/** Returns null when WebGL is unavailable; callers should show a static fallback. */
export function createAura(canvas: HTMLCanvasElement, color = '#9d8cf2'): Aura | null {
  const gl = canvas.getContext('webgl');
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    return shader;
  };

  const fragment =
    'precision highp float;\nuniform vec2 iResolution; uniform float iTime;\n' +
    'uniform float uSpeed, uBlur, uScale, uShape, uFrequency, uAmplitude, uBloom, uMix, uSpacing, uColorShift, uVariance, uSmoothing, uMode;\n' +
    'uniform vec3 uColor;\n' + SHADER +
    '\nvoid main(void) { vec4 color = vec4(0.0); mainImage(color, gl_FragCoord.xy); gl_FragColor = color; }';

  const program = gl.createProgram()!;
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec3 p; void main(void) { gl_Position = vec4(p, 1.0); }'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
  } catch {
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
  gl.clearColor(0, 0, 0, 0);

  const u = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]));
  // Fixed values, as AgentAudioVisualizerAura passes them. Light-background mode.
  gl.uniform1f(u.uSpeed, 1.0); // speed is integrated into iTime below
  gl.uniform1f(u.uBlur, 0.2);
  gl.uniform1f(u.uShape, 1.0);
  gl.uniform1f(u.uBloom, 0.0);
  gl.uniform1f(u.uSpacing, 0.5);
  gl.uniform1f(u.uColorShift, 0.05);
  gl.uniform1f(u.uVariance, 0.1);
  gl.uniform1f(u.uSmoothing, 1.0);
  gl.uniform1f(u.uMode, 1.0);
  gl.uniform3fv(u.uColor, hexToRgb(color));

  let speed = 10;
  let volume = 0;
  let state: AuraState | null = null;
  const scale = animated(0.2);
  const amplitude = animated(2);
  const frequency = animated(0.5);
  const brightness = animated(1.5);
  let time = 0, last = 0, raf = 0, running = false;

  const apply = (next: AuraState, now: number) => {
    state = next;
    const TWEEN = 500;
    const PULSE = 350;
    if (next === 'listening') {
      speed = 20;
      scale.spring(0.3, now);
      amplitude.tween(1.0, TWEEN, now);
      frequency.tween(0.7, TWEEN, now);
      brightness.pulse(1.5, 2.0, PULSE, now);
    } else if (next === 'thinking') {
      speed = 30;
      scale.tween(0.3, TWEEN, now);
      amplitude.tween(0.5, TWEEN, now);
      frequency.tween(1, TWEEN, now);
      brightness.pulse(0.5, 2.5, PULSE, now);
    } else if (next === 'speaking') {
      speed = 70;
      scale.tween(0.3, TWEEN, now);
      amplitude.tween(0.75, TWEEN, now);
      frequency.tween(1.25, TWEEN, now);
      brightness.tween(1.5, TWEEN, now);
    } else {
      speed = 10;
      scale.tween(0.2, TWEEN, now);
      amplitude.tween(1.2, TWEEN, now);
      frequency.tween(0.4, TWEEN, now);
      brightness.tween(1.0, TWEEN, now);
    }
  };

  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    time += dt * speed;
    if (state === 'speaking' && volume > 0 && !scale.isAnimating(now)) scale.set(0.2 + 0.2 * volume);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.iResolution, canvas.width, canvas.height);
    gl.uniform1f(u.iTime, time);
    gl.uniform1f(u.uScale, scale.step(now));
    gl.uniform1f(u.uAmplitude, amplitude.step(now));
    gl.uniform1f(u.uFrequency, frequency.step(now));
    gl.uniform1f(u.uMix, brightness.step(now));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  apply('idle', performance.now());
  return {
    setState(next) {
      if (next !== state) apply(next, performance.now());
    },
    setVolume(v) {
      volume = v;
    },
    play() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
