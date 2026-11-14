/*!
 * Embeddable voice + chat widget for Sabith's AI assistant.
 *
 *   <script src="https://YOUR-WORKER-HOST/embed/embed.js" defer></script>
 *
 * Optional attributes on the script tag:
 *   data-api-base   Origin serving POST /api/v1/token   (default: this script's origin)
 *   data-title      Header text                         (default: "Sabith's AI assistant")
 *   data-accent     Accent and aura colour, #rrggbb     (default: "#5eead4")
 *   data-position   "right" or "left"                   (default: "right")
 *   data-theme      "auto", "light" or "dark"           (default: "auto")
 *
 * Rendered in a shadow root, so host-page styles do not leak in or out.
 * Scriptable: window.VoiceAssistant.open() / close() / start() / stop() / setTheme(t).
 *
 * The aura visualizer's shader is adapted from LiveKit Agents UI, originally developed
 * for Unicorn Studio (https://unicorn.studio), © 2026 UNCRN LLC, licensed under the
 * Polyform Non-Resale License 1.0.0.
 */
(function () {
  'use strict';
  if (window.VoiceAssistant) return;

  var script = document.currentScript;
  var data = (script && script.dataset) || {};
  var config = {
    apiBase: (data.apiBase || (script ? new URL(script.src).origin : location.origin)).replace(/\/$/, ''),
    title: data.title || "Sabith's AI assistant",
    accent: /^#[0-9a-f]{6}$/i.test(data.accent || '') ? data.accent : '#5eead4',
    position: data.position === 'left' ? 'left' : 'right',
    theme: data.theme === 'light' || data.theme === 'dark' ? data.theme : 'auto',
  };
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js';
  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Pick dark or white text for the accent colour so buttons stay readable.
  var onAccent = (function (hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.4 ? '#0b1014' : '#ffffff';
  })(config.accent);
  var side = config.position;
  var otherSide = side === 'left' ? 'right' : 'left';

  /* ------------------------------------------------------------- icons */
  var ICONS = {
    agent: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M2 14h2M20 14h2M9.5 13v2M14.5 13v2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    micOff:
      '<path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.4 2.3M12 18v3M3 3l18 18"/>',
    end: '<path transform="rotate(135 12 12)" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    send: '<path d="m5 12 14-7-5 15-2.5-6.5L5 12Z"/>',
  };
  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>'
    );
  }

  /* ----------------------------------------------------------------- css */
  var CSS = [
    ':host{all:initial;position:fixed;bottom:20px;' + side + ':20px;z-index:2147483000;',
    "font-family:'Inter Variable',Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.45;-webkit-font-smoothing:antialiased;",
    '--accent:' + config.accent + ';--on-accent:' + onAccent + ';--ease:cubic-bezier(.22,1,.36,1);',
    '--bg:#ffffff;--bg-2:#f4f6fb;--fg:#141824;--fg-2:#5b6478;--line:rgba(20,24,36,.1);--bubble:#eef1f7;--shadow:0 24px 60px -18px rgba(20,24,40,.35),0 2px 8px rgba(20,24,40,.06)}',
    ':host([data-mode=dark]){--bg:#11151c;--bg-2:#161b24;--fg:#e8ecf3;--fg-2:#97a1b4;--line:rgba(255,255,255,.08);--bubble:#1c2230;--shadow:0 24px 60px -18px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.3)}',
    '*{box-sizing:border-box}',
    '.wrap{display:flex;flex-direction:column;align-items:flex-' + (side === 'left' ? 'start' : 'end') + ';gap:12px}',
    'button,input{font:inherit;color:inherit}',
    'button{cursor:pointer;border:0;background:none;padding:0}',
    'button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    'svg{width:20px;height:20px;display:block}',

    /* launcher: a round agent button with a hand badge that waves now and then */
    '.dock{order:2;position:relative;display:flex}',
    '.launcher{position:relative;display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--accent);color:var(--on-accent);',
    'box-shadow:var(--shadow);transition:transform .4s var(--ease),background-color .3s}',
    '.launcher:hover{transform:translateY(-2px) scale(1.04)}',
    '.launcher:active{transform:scale(.94)}',
    '.launcher svg{width:24px;height:24px}',
    '.launcher .ico{position:absolute;inset:0;display:grid;place-items:center;transition:transform .45s var(--ease),opacity .25s}',
    '.launcher .ico-close{opacity:0;transform:rotate(-90deg) scale(.6)}',
    '.is-open .launcher .ico-chat{opacity:0;transform:rotate(90deg) scale(.6)}',
    '.is-open .launcher .ico-close{opacity:1;transform:none}',
    '.wave{position:absolute;top:-8px;' + otherSide + ':-6px;font-size:20px;line-height:1;pointer-events:none;',
    'filter:drop-shadow(0 1px 2px rgba(20,24,40,.25));transition:opacity .3s var(--ease),transform .45s var(--ease)}',
    '.wave span{display:block;transform-origin:70% 75%}',
    '.wave.on{transform:scale(1.15)}',
    '.wave.on span{animation:wave 1.6s ease-in-out}',
    '.is-open .wave{opacity:0;transform:scale(.4)}',
    '@keyframes wave{0%,100%{transform:rotate(0)}10%,30%,50%{transform:rotate(18deg)}20%,40%{transform:rotate(-10deg)}60%{transform:rotate(0)}}',

    /* panel: animates open from the launcher's corner */
    '.panel{order:1;display:flex;flex-direction:column;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100dvh - 104px));',
    'background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);',
    'transform-origin:bottom ' + side + ';opacity:0;transform:translateY(16px) scale(.94);visibility:hidden;pointer-events:none;',
    'transition:opacity .28s var(--ease),transform .45s var(--ease),visibility 0s linear .45s}',
    '.is-open .panel{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .3s var(--ease),transform .5s var(--ease),visibility 0s}',
    '@media (prefers-reduced-motion:reduce){.panel,.launcher,.launcher .ico,.wave,.stage{transition:none!important}.wave.on span{animation:none}}',

    'header{display:flex;align-items:center;gap:10px;padding:14px 14px 10px 18px}',
    'header .titles{flex:1;min-width:0}',
    'header strong{display:block;font-size:15px;font-weight:650;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    'header .status{display:flex;align-items:center;gap:6px;color:var(--fg-2);font-size:12px}',
    'header .status i{width:7px;height:7px;border-radius:50%;background:var(--fg-2);opacity:.6;transition:background-color .3s}',
    '.live header .status i{background:#22c55e;opacity:1}',
    '.icon-btn{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;color:var(--fg-2);transition:background-color .2s,color .2s}',
    '.icon-btn:hover{background:var(--bg-2);color:var(--fg)}',

    /* aura stage: large before a chat starts, compact once messages arrive */
    '.stage{position:relative;height:248px;flex:none;overflow:hidden;transition:height .5s var(--ease)}',
    '.has-messages .stage{height:150px}',
    // Square canvas centred in the stage, so the aura is never stretched as the stage resizes.
    'canvas{position:absolute;top:0;left:50%;height:calc(100% - 24px);width:auto;aspect-ratio:1;transform:translateX(-50%);display:block}',
    '.state{position:absolute;bottom:4px;left:0;right:0;text-align:center;color:var(--fg-2);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;transition:opacity .3s}',

    '.log{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 16px 12px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin}',
    '.msg{max-width:85%;padding:9px 13px;border-radius:18px;background:var(--bubble);white-space:pre-wrap;overflow-wrap:anywhere;animation:rise .35s var(--ease) both}',
    '.msg.user{align-self:flex-end;background:var(--accent);color:var(--on-accent);border-bottom-right-radius:6px}',
    '.msg.agent{align-self:flex-start;border-bottom-left-radius:6px}',
    '.note{align-self:center;max-width:90%;color:var(--fg-2);font-size:13px;text-align:center;animation:rise .35s var(--ease) both}',
    '@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',

    'footer{padding:12px;border-top:1px solid var(--line);background:var(--bg-2)}',
    '.start{width:100%;height:48px;border-radius:999px;background:var(--accent);color:var(--on-accent);font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform .3s var(--ease),opacity .2s}',
    '.start:active{transform:scale(.98)}',
    '.start:disabled{opacity:.6;cursor:default}',
    '.controls{display:none;gap:8px;align-items:center}',
    '.live .controls{display:flex}',
    '.live .start{display:none}',
    '.field{flex:1;min-width:0;display:flex;align-items:center;height:44px;padding:0 6px 0 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg)}',
    '.field input{flex:1;min-width:0;border:0;background:none;outline:none;font-size:14px}',
    '.field input::placeholder{color:var(--fg-2)}',
    '.send{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--accent);color:var(--on-accent);transition:transform .2s,opacity .2s}',
    '.send:disabled{opacity:.35;cursor:default}',
    '.round{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;flex:none;background:var(--bubble);color:var(--fg);transition:background-color .25s,color .25s,transform .25s var(--ease)}',
    '.round:active{transform:scale(.92)}',
    '.mic[aria-pressed=true]{background:rgba(239,68,68,.14);color:#ef4444}',
    '.end{background:#ef4444;color:#fff}',
    '.end:hover{background:#dc2626}',

    '@media (max-width:480px){:host{bottom:12px;' + side + ':12px;' + otherSide + ':12px}',
    '.panel{width:100%;height:min(640px,calc(100dvh - 88px))}}',
  ].join('');

  /* ----------------------------------------------------------------- dom */
  var host = document.createElement('div');
  host.id = 'voice-assistant-widget';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' + CSS + '</style>' +
    '<div class="wrap">' +
    '<section class="panel" role="dialog" aria-label="AI assistant" aria-hidden="true">' +
    '<header><div class="titles"><strong></strong><span class="status"><i></i><span class="status-text">Online</span></span></div>' +
    '<button class="icon-btn close" type="button" aria-label="Close">' + icon('close') + '</button></header>' +
    '<div class="stage"><canvas aria-hidden="true"></canvas><div class="state">Ready</div></div>' +
    '<div class="log" role="log" aria-live="polite"></div>' +
    '<footer>' +
    '<button class="start" type="button">' + icon('mic') + '<span>Start conversation</span></button>' +
    '<div class="controls">' +
    '<label class="field"><input type="text" placeholder="Type a message…" aria-label="Message" maxlength="500">' +
    '<button class="send" type="button" aria-label="Send" disabled>' + icon('send') + '</button></label>' +
    '<button class="round mic" type="button" aria-pressed="false" aria-label="Mute microphone" title="Mute microphone">' + icon('mic') + '</button>' +
    '<button class="round end" type="button" aria-label="End conversation" title="End conversation">' + icon('end') + '</button>' +
    '</div></footer></section>' +
    '<div class="dock">' +
    '<button class="launcher" type="button" aria-expanded="false" aria-label="Talk to my AI assistant" title="Talk to my AI assistant">' +
    '<span class="ico ico-chat">' + icon('agent') + '</span><span class="ico ico-close">' + icon('chevron') + '</span>' +
    '<span class="wave" aria-hidden="true"><span>\uD83D\uDC4B</span></span></button></div>' +
    '</div>';

  function $(sel) { return root.querySelector(sel); }
  var wrap = $('.wrap'), panel = $('.panel'), log = $('.log'), startBtn = $('.start'), input = $('input'),
    sendBtn = $('.send'), micBtn = $('.mic'), launcher = $('.launcher'), wave = $('.wave'), stateEl = $('.state'),
    statusText = $('.status-text'), canvas = $('canvas');
  $('header strong').textContent = config.title;

  var room = null, LK = null, bubbles = {}, audioEls = [], agentState = 'idle';

  /* --------------------------------------------------------------- theme */
  var themeQuery = matchMedia('(prefers-color-scheme: dark)');
  function resolvedTheme() {
    return config.theme === 'auto' ? (themeQuery.matches ? 'dark' : 'light') : config.theme;
  }
  function applyTheme() {
    host.setAttribute('data-mode', resolvedTheme());
    if (aura) aura.setTheme(resolvedTheme());
  }
  themeQuery.addEventListener('change', applyTheme);

  /* -------------------------------------------------------- aura (WebGL) */
  // A faithful port of LiveKit Agents UI's AgentAudioVisualizerAura: the same shader,
  // uniforms, renderer setup (no blending, device-pixel-ratio canvas) and per-state
  // animations, without React.
  var AURA_SHADER = [
    'const float TAU = 6.283185;',
    'vec2 randFibo(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.xx + p.yx) * p.xy); }',
    'vec3 Tonemap(vec3 x) { x *= 4.0; return x / (1.0 + x); }',
    'float luma(vec3 color) { return dot(color, vec3(0.299, 0.587, 0.114)); }',
    'vec3 rgb2hsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));',
    '  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10;',
    '  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }',
    'vec3 hsv2rgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }',
    'float sdCircle(vec2 st, float r) { return length(st) - r; }',
    'float sdLine(vec2 p, float r) { float halfLen = r * 2.0; vec2 a = vec2(-halfLen, 0.0); vec2 b = vec2(halfLen, 0.0); vec2 pa = p - a; vec2 ba = b - a;',
    '  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }',
    'float getSdf(vec2 st) { if (uShape == 1.0) return sdCircle(st, uScale); else if (uShape == 2.0) return sdLine(st, uScale); return sdCircle(st, uScale); }',
    'vec2 turb(vec2 pos, float t, float it) {',
    '  mat2 rotation = mat2(0.6, -0.25, 0.25, 0.9); mat2 layerRotation = mat2(0.6, -0.8, 0.8, 0.6);',
    '  float frequency = mix(2.0, 15.0, uFrequency); float amplitude = uAmplitude; float frequencyGrowth = 1.4;',
    '  float animTime = t * 0.1 * uSpeed;',
    '  const int LAYERS = 4;',
    '  for (int i = 0; i < LAYERS; i++) {',
    '    vec2 rotatedPos = pos * rotation; vec2 wave = sin(frequency * rotatedPos + float(i) * animTime + it);',
    '    pos += (amplitude / frequency) * rotation[0] * wave;',
    '    rotation *= layerRotation; amplitude *= mix(1.0, max(wave.x, wave.y), uVariance); frequency *= frequencyGrowth;',
    '  }',
    '  return pos;',
    '}',
    'const float ITERATIONS = 36.0;',
    'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
    '  vec2 uv = fragCoord / iResolution.xy; vec3 pp = vec3(0.0); vec3 bloom = vec3(0.0); float t = iTime * 0.5; vec2 pos = uv - 0.5;',
    '  vec2 prevPos = turb(pos, t, 0.0 - 1.0 / ITERATIONS); float spacing = mix(1.0, TAU, uSpacing);',
    '  for (float i = 1.0; i < ITERATIONS + 1.0; i++) {',
    '    float iter = i / ITERATIONS; vec2 st = turb(pos, t, iter * spacing); float d = abs(getSdf(st)); float pd = distance(st, prevPos); prevPos = st;',
    '    float dynamicBlur = exp2(pd * 2.0 * 1.4426950408889634) - 1.0;',
    '    float ds = smoothstep(0.0, uBlur * 0.05 + max(dynamicBlur * uSmoothing, 0.001), d);',
    '    vec3 color = uColor;',
    '    if (uColorShift > 0.01) { vec3 hsv = rgb2hsv(color); hsv.x = fract(hsv.x + (1.0 - iter) * uColorShift * 0.3); color = hsv2rgb(hsv); }',
    '    float invd = 1.0 / max(d + dynamicBlur, 0.001); pp += (ds - 1.0) * color; bloom += clamp(invd, 0.0, 250.0) * color;',
    '  }',
    '  pp *= 1.0 / ITERATIONS;',
    '  vec3 color;',
    '  if (uMode < 0.5) {',
    '    bloom = bloom / (bloom + 2e4); color = (-pp + bloom * 3.0 * uBloom) * 1.2; color += (randFibo(fragCoord).x - 0.5) / 255.0;',
    '    color = Tonemap(color); float alpha = luma(color) * uMix; fragColor = vec4(color * uMix, alpha);',
    '  } else {',
    '    color = -pp; color += (randFibo(fragCoord).x - 0.5) / 255.0;',
    '    float brightness = length(color); vec3 direction = brightness > 0.0 ? color / brightness : color;',
    '    float factor = 2.0; float mappedBrightness = (brightness * factor) / (1.0 + brightness * factor); color = direction * mappedBrightness;',
    '    float gray = dot(color, vec3(0.2, 0.5, 0.1)); float saturationBoost = 3.0; color = mix(vec3(gray), color, saturationBoost);',
    '    color = clamp(color, 0.0, 1.0); float alpha = mappedBrightness * clamp(uMix, 1.0, 2.0); fragColor = vec4(color, alpha);',
    '  }',
    '}',
  ].join('\n');

  var AURA_UNIFORMS = ['iResolution', 'iTime', 'uSpeed', 'uBlur', 'uScale', 'uShape', 'uFrequency', 'uAmplitude',
    'uBloom', 'uMix', 'uSpacing', 'uColorShift', 'uVariance', 'uSmoothing', 'uMode', 'uColor'];

  function hexToRgb(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; });
  }

  // motion's "easeOut" is cubic-bezier(0, 0, 0.58, 1).
  function easeOut(x) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 24; i++) {
      var tt = (lo + hi) / 2, bx = 3 * (1 - tt) * tt * tt * 0.58 + tt * tt * tt;
      if (bx < x) lo = tt; else hi = tt;
    }
    var t = (lo + hi) / 2;
    return 3 * (1 - t) * t * t + t * t * t;
  }

  // One animated number, mirroring the transitions useAgentAudioVisualizerAura uses:
  // eased tweens, a mirrored brightness pulse, and a spring.
  function animatedValue(initial) {
    var v = initial, mode = 'idle', from = 0, to = 0, start = 0, duration = 0, a = 0, b = 0;
    return {
      tween: function (target, ms, now) { mode = 'tween'; from = v; to = target; start = now; duration = ms; },
      // keyframes [lo, hi] with repeatType "mirror": lo -> hi, hi -> lo, forever.
      pulse: function (lo, hi, ms, now) { mode = 'pulse'; a = lo; b = hi; start = now; duration = ms; },
      // { type: 'spring', duration: 1.0, bounce: 0.35 }: underdamped, settles in about a second.
      spring: function (target, now) { mode = 'spring'; from = v; to = target; start = now; },
      set: function (x) { mode = 'idle'; v = x; },
      isAnimating: function (now) {
        if (mode === 'tween') return now - start < duration;
        if (mode === 'spring') return now - start < 1200;
        return mode === 'pulse';
      },
      step: function (now) {
        var t;
        if (mode === 'tween') {
          t = Math.min(1, (now - start) / duration);
          v = from + (to - from) * easeOut(t);
          if (t >= 1) mode = 'idle';
        } else if (mode === 'pulse') {
          var cycle = (now - start) / duration, n = Math.floor(cycle), p = cycle - n;
          v = a + (b - a) * (n % 2 === 0 ? easeOut(p) : easeOut(1 - p));
        } else if (mode === 'spring') {
          t = (now - start) / 1000;
          var zeta = 0.65, w0 = (2 * Math.PI) / 0.95, wd = w0 * Math.sqrt(1 - zeta * zeta);
          var x = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
          v = from + (to - from) * x;
          if (t >= 1.2) { v = to; mode = 'idle'; }
        }
        return v;
      },
    };
  }

  function createAura(cv) {
    var glOpts = { antialias: false, powerPreference: 'low-power' };
    var gl = cv.getContext('webgl', glOpts) || cv.getContext('experimental-webgl', glOpts);
    if (!gl) return null;
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader error');
      return s;
    }
    var fs = 'precision highp float;\n' +
      'uniform vec2 iResolution; uniform float iTime;\n' +
      'uniform float uSpeed, uBlur, uScale, uShape, uFrequency, uAmplitude, uBloom, uMix, uSpacing, uColorShift, uVariance, uSmoothing, uMode;\n' +
      'uniform vec3 uColor;\n' + AURA_SHADER +
      '\nvoid main(void) { vec4 color = vec4(0.0); mainImage(color, gl_FragCoord.xy); gl_FragColor = color; }';
    var prog = gl.createProgram();
    try {
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec3 aVertexPosition; void main(void) { gl_Position = vec4(aVertexPosition, 1.0); }'));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link error');
    } catch {
      return null;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aVertexPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 1);
    var u = {};
    AURA_UNIFORMS.forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    // Fixed values, as AgentAudioVisualizerAura passes them to AuraShader.
    gl.uniform1f(u.uSpeed, 1.0); // speed is integrated into iTime below
    gl.uniform1f(u.uBlur, 0.2);
    gl.uniform1f(u.uShape, 1.0);
    gl.uniform1f(u.uBloom, 0.0);
    gl.uniform1f(u.uSpacing, 0.5);
    gl.uniform1f(u.uColorShift, 0.05);
    gl.uniform1f(u.uVariance, 0.1);
    gl.uniform1f(u.uSmoothing, 1.0);
    gl.uniform3fv(u.uColor, hexToRgb(config.accent));

    // useAgentAudioVisualizerAura's starting values.
    var speed = 10, mode = 0, volume = 0, state = 'idle';
    var scale = animatedValue(0.2), amplitude = animatedValue(2), frequency = animatedValue(0.5), brightness = animatedValue(1.5);
    var time = 0, last = 0, raf = 0, running = false;

    // Rendering budget: at most 1.5x pixel density; on a low-end device 1x at 30
    // frames a second. If frames still run long, the resolution steps down.
    var nav = navigator;
    var lowEnd = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4 || !!(nav.connection && nav.connection.saveData);
    var quality = Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.5);
    var minFrame = lowEnd ? 1000 / 30 - 2 : 0;
    var drawn = 0, slow = 0, frames = 0, cssW = 0, cssH = 0;
    if (window.ResizeObserver) {
      new ResizeObserver(function (entries) {
        cssW = entries[0].contentRect.width;
        cssH = entries[0].contentRect.height;
      }).observe(cv);
    }

    function applyState(s, now) {
      state = s;
      var TWEEN = 500, PULSE = 350;
      switch (s) {
        case 'listening':
          speed = 20;
          scale.spring(0.3, now);
          amplitude.tween(1.0, TWEEN, now);
          frequency.tween(0.7, TWEEN, now);
          brightness.pulse(1.5, 2.0, PULSE, now);
          return;
        case 'thinking':
        case 'connecting':
          speed = 30;
          scale.tween(0.3, TWEEN, now);
          amplitude.tween(0.5, TWEEN, now);
          frequency.tween(1, TWEEN, now);
          brightness.pulse(0.5, 2.5, PULSE, now);
          return;
        case 'speaking':
          speed = 70;
          scale.tween(0.3, TWEEN, now);
          amplitude.tween(0.75, TWEEN, now);
          frequency.tween(1.25, TWEEN, now);
          brightness.tween(1.5, TWEEN, now);
          return;
        default: // idle, failed, disconnected
          speed = 10;
          scale.tween(0.2, TWEEN, now);
          amplitude.tween(1.2, TWEEN, now);
          frequency.tween(0.4, TWEEN, now);
          brightness.tween(1.0, TWEEN, now);
      }
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (minFrame && now - drawn < minFrame) return;
      var gap = drawn ? now - drawn : 16;
      drawn = now;
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      // iTime * uSpeed in the original; integrating keeps the motion continuous
      // when the speed changes between states.
      time += dt * speed;

      if (state === 'speaking' && volume > 0 && !scale.isAnimating(now)) scale.set(0.2 + 0.2 * volume);

      frames++;
      if (gap > (minFrame || 16.7) * 1.6) slow++;
      if (frames === 90) {
        if (slow > 30 && quality > 0.5) quality = Math.max(0.5, quality * 0.75);
        frames = slow = 0;
      }
      if (!cssW) { cssW = cv.clientWidth; cssH = cv.clientHeight; }
      var w = Math.floor(cssW * quality), h = Math.floor(cssH * quality);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.iResolution, cv.width, cv.height);
      gl.uniform1f(u.iTime, time);
      gl.uniform1f(u.uScale, scale.step(now));
      gl.uniform1f(u.uAmplitude, amplitude.step(now));
      gl.uniform1f(u.uFrequency, frequency.step(now));
      gl.uniform1f(u.uMix, brightness.step(now));
      gl.uniform1f(u.uMode, mode);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    applyState('idle', performance.now());
    return {
      setState: function (s) { if (s !== state) applyState(s, performance.now()); },
      setVolume: function (v) { volume = v; },
      setTheme: function (t) { mode = t === 'light' ? 1 : 0; },
      play: function () { if (!running) { running = true; last = 0; drawn = 0; raf = requestAnimationFrame(frame); } },
      pause: function () { running = false; cancelAnimationFrame(raf); },
    };
  }

  var aura = createAura(canvas);
  if (!aura) canvas.style.display = 'none';

  /* ---------------------------------------------------- agent voice level */
  // As LiveKit's useTrackVolume: an analyser (fftSize 512, smoothing 0.55,
  // -100..-80 dB), read 30 times a second as the RMS of the frequency bins.
  var analyser = null, bins = null, audioCtx = null;
  function watchAgentAudio(track) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var src = audioCtx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
      analyser = audioCtx.createAnalyser();
      analyser.minDecibels = -100;
      analyser.maxDecibels = -80;
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(analyser);
      bins = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      analyser = null;
    }
  }
  setInterval(function () {
    if (!analyser || !aura) return;
    analyser.getByteFrequencyData(bins);
    var sum = 0;
    for (var i = 0; i < bins.length; i++) sum += bins[i] * bins[i];
    aura.setVolume(Math.sqrt(sum / bins.length) / 255);
  }, 1000 / 30);

  /* ------------------------------------------------------------ ui state */
  var STATE_LABELS = {
    idle: 'Ready', connecting: 'Connecting…', initializing: 'Getting ready…', listening: 'Listening',
    thinking: 'Thinking…', speaking: 'Speaking',
  };
  function setAgentState(s) {
    agentState = s === 'initializing' ? 'connecting' : s;
    stateEl.textContent = STATE_LABELS[s] || 'Ready';
    if (aura) aura.setState(agentState);
  }

  function addLine(text, cls) {
    var el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    log.appendChild(el);
    if (cls.indexOf('msg') === 0) wrap.classList.add('has-messages');
    log.scrollTo({ top: log.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    return el;
  }
  function note(text) { return addLine(text, 'note'); }

  // The agent ends every conversation at its time limit; the widget shows the time
  // left, and disconnects itself shortly after the limit as a safety net.
  var deadline = 0, ticker = 0, endedByLimit = false;
  function fmt(sec) { return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function tick() {
    var left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    statusText.textContent = 'In conversation · ' + fmt(left) + ' left';
    if (Date.now() > deadline + 5000 && room) { endedByLimit = true; stop(); }
    else if (left === 0) endedByLimit = true;
  }
  function startCountdown(seconds) {
    deadline = Date.now() + seconds * 1000;
    endedByLimit = false;
    clearInterval(ticker);
    ticker = setInterval(tick, 1000);
    tick();
  }

  function setLive(live) {
    wrap.classList.toggle('live', live);
    if (!live) clearInterval(ticker);
    statusText.textContent = live ? 'In conversation' : 'Online';
    startBtn.disabled = false;
    startBtn.lastChild.textContent = 'Start conversation';
  }

  var greeted = false;
  function setOpen(open) {
    wrap.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close assistant' : 'Talk to my AI assistant');
    launcher.title = open ? 'Close assistant' : 'Talk to my AI assistant';
    if (open) wave.classList.remove('on');
    panel.setAttribute('aria-hidden', String(!open));
    if (open) {
      if (aura) aura.play();
      if (!greeted) {
        greeted = true;
        note('Ask about Sabith’s work, or leave him a message. You can talk or type.');
      }
    } else if (aura) {
      // Keep animating through the close transition, then stop drawing.
      setTimeout(function () { if (!wrap.classList.contains('is-open')) aura.pause(); }, 500);
    }
  }

  /* --------------------------------------------------------- connection */
  function loadSdk() {
    if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK_URL;
      s.onload = function () { resolve(window.LivekitClient); };
      s.onerror = function () { reject(new Error('Could not load the audio library.')); };
      document.head.appendChild(s);
    });
  }

  function fetchToken() {
    return fetch(config.apiBase + '/api/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function (resp) {
      if (resp.ok) return resp.json();
      return resp.json().catch(function () { return {}; }).then(function (body) {
        throw new Error(resp.status === 429 && body.detail ? body.detail : 'The assistant is unavailable right now.');
      });
    });
  }

  // Agent and user speech both arrive as text streams; one bubble per segment.
  async function onTranscription(reader, participantInfo) {
    var attrs = (reader.info && reader.info.attributes) || {};
    var key = attrs['lk.segment_id'] || reader.info.id;
    var isUser = room && participantInfo.identity === room.localParticipant.identity;
    var text = '';
    for await (var chunk of reader) {
      text += chunk;
      if (!text.trim()) continue;
      if (!bubbles[key]) bubbles[key] = addLine('', 'msg ' + (isUser ? 'user' : 'agent'));
      bubbles[key].textContent = text;
      log.scrollTop = log.scrollHeight;
    }
  }

  function syncAgentState() {
    if (!room) return;
    room.remoteParticipants.forEach(function (p) {
      var s = p.attributes && p.attributes['lk.agent.state'];
      if (s) setAgentState(s);
    });
  }

  function renderMic() {
    var muted = !(room && room.localParticipant.isMicrophoneEnabled);
    micBtn.setAttribute('aria-pressed', String(muted));
    micBtn.innerHTML = icon(muted ? 'micOff' : 'mic');
    var label = muted ? 'Unmute microphone' : 'Mute microphone';
    micBtn.title = label;
    micBtn.setAttribute('aria-label', label);
  }

  async function setMic(enabled) {
    if (!room) return;
    micBtn.disabled = true;
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    } catch {
      if (enabled) note('Microphone unavailable — you can still type.');
    } finally {
      micBtn.disabled = false;
      renderMic();
    }
  }

  function cleanup() {
    audioEls.forEach(function (el) { el.remove(); });
    audioEls = [];
    bubbles = {};
    analyser = null;
    room = null;
    setLive(false);
    setAgentState('idle');
  }

  async function start() {
    if (room) return setOpen(true);
    host.setAttribute('data-engaged', '');
    setOpen(true);
    startBtn.disabled = true;
    startBtn.lastChild.textContent = 'Connecting…';
    setAgentState('connecting');
    try {
      var results = await Promise.all([loadSdk(), fetchToken()]);
      LK = results[0];
      var session = results[1];
      room = new LK.Room({ adaptiveStream: true, dynacast: true });
      room.on(LK.RoomEvent.TrackSubscribed, function (track) {
        if (track.kind !== 'audio') return;
        var el = track.attach();
        el.style.display = 'none';
        document.body.appendChild(el);
        audioEls.push(el);
        watchAgentAudio(track);
      });
      room.on(LK.RoomEvent.ParticipantAttributesChanged, syncAgentState);
      room.on(LK.RoomEvent.ParticipantConnected, syncAgentState);
      room.on(LK.RoomEvent.LocalTrackPublished, renderMic);
      room.on(LK.RoomEvent.TrackMuted, renderMic);
      room.on(LK.RoomEvent.TrackUnmuted, renderMic);
      room.on(LK.RoomEvent.Disconnected, function () {
        note(endedByLimit
          ? 'Time’s up — conversations are limited to ' + fmt(session.max_duration_seconds || 90) + '. Email Sabith for anything more.'
          : 'Conversation ended.');
        cleanup();
      });
      room.registerTextStreamHandler('lk.transcription', onTranscription);
      await room.connect(session.server_url, session.participant_token);
      await room.startAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      setLive(true);
      startCountdown(session.max_duration_seconds || 90);
      if (session.sessions_remaining_today === 0) note('This is your last conversation for today.');
      await setMic(true);
      syncAgentState();
      input.focus({ preventScroll: true });
    } catch (err) {
      if (room) { try { await room.disconnect(); } catch { /* already closed */ } }
      cleanup();
      note(err && err.message ? err.message : 'Could not connect. Please try again.');
    }
  }

  async function stop() {
    if (room) await room.disconnect();
  }

  async function sendText() {
    var text = input.value.trim();
    if (!text || !room) return;
    input.value = '';
    sendBtn.disabled = true;
    addLine(text, 'msg user');
    try {
      await room.localParticipant.sendText(text, { topic: 'lk.chat' });
    } catch {
      note('Message not sent. Please try again.');
    }
  }

  launcher.addEventListener('click', function () { setOpen(!wrap.classList.contains('is-open')); });

  // Every 10 seconds, while the panel is closed and the tab is visible, a hand
  // on the launcher waves for 2 seconds.
  setInterval(function () {
    if (wrap.classList.contains('is-open') || document.hidden) return;
    wave.classList.add('on');
    setTimeout(function () { wave.classList.remove('on'); }, 2000);
  }, 10000);
  $('.close').addEventListener('click', function () { setOpen(false); });
  startBtn.addEventListener('click', start);
  $('.end').addEventListener('click', stop);
  micBtn.addEventListener('click', function () {
    if (room) setMic(!room.localParticipant.isMicrophoneEnabled);
  });
  input.addEventListener('input', function () { sendBtn.disabled = !input.value.trim(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendText(); });
  sendBtn.addEventListener('click', sendText);
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wrap.classList.contains('is-open')) setOpen(false);
  });

  applyTheme();
  function mount() { document.body.appendChild(host); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  window.VoiceAssistant = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    start: start,
    stop: stop,
    setTheme: function (t) {
      config.theme = t === 'light' || t === 'dark' ? t : 'auto';
      applyTheme();
    },
  };
})();
