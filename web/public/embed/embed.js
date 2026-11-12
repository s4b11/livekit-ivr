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
  var side = config.position;
  var otherSide = side === 'left' ? 'right' : 'left';

  /* ------------------------------------------------------------- icons */
  var ICONS = {
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12Z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    micOff:
      '<path d="M15 9.3V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.4 2.3M12 18v3M3 3l18 18"/>',
    end: '<path d="M10.7 13.3a13 13 0 0 1-2.4-3.2l1.7-1.7a1 1 0 0 0 .2-1.1L9 4.6A1 1 0 0 0 7.9 4H5a1 1 0 0 0-1 1.1A17 17 0 0 0 9 15.6M13.4 16.5a17 17 0 0 0 5.5 2.5 1 1 0 0 0 1.1-1v-2.9a1 1 0 0 0-.6-.9l-2.7-1a1 1 0 0 0-1.1.2l-1 1M3 3l18 18"/>',
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
    '--accent:' + config.accent + ';--ease:cubic-bezier(.22,1,.36,1);',
    '--bg:#ffffff;--bg-2:#f4f6fb;--fg:#141824;--fg-2:#5b6478;--line:rgba(20,24,36,.1);--bubble:#eef1f7;--shadow:0 24px 60px -18px rgba(20,24,40,.35),0 2px 8px rgba(20,24,40,.06)}',
    ':host([data-mode=dark]){--bg:#11151c;--bg-2:#161b24;--fg:#e8ecf3;--fg-2:#97a1b4;--line:rgba(255,255,255,.08);--bubble:#1c2230;--shadow:0 24px 60px -18px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.3)}',
    '*{box-sizing:border-box}',
    '.wrap{display:flex;flex-direction:column;align-items:flex-' + (side === 'left' ? 'start' : 'end') + ';gap:12px}',
    'button,input{font:inherit;color:inherit}',
    'button{cursor:pointer;border:0;background:none;padding:0}',
    'button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
    'svg{width:20px;height:20px;display:block}',

    /* launcher */
    '.launcher{order:2;display:flex;align-items:center;gap:10px;height:52px;padding:0 20px 0 16px;border-radius:999px;background:var(--fg);color:var(--bg);font-weight:600;letter-spacing:-.01em;',
    'box-shadow:var(--shadow);transition:transform .4s var(--ease),padding .4s var(--ease),width .4s var(--ease),background-color .3s}',
    '.launcher:hover{transform:translateY(-2px)}',
    '.launcher:active{transform:scale(.96)}',
    '.launcher .dot{position:relative;width:9px;height:9px;border-radius:50%;background:var(--accent)}',
    '.launcher .dot::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--accent);animation:ping 2s var(--ease) infinite}',
    '@keyframes ping{from{transform:scale(1);opacity:.8}to{transform:scale(3);opacity:0}}',
    '.launcher .ico{display:none}',
    '.is-open .launcher{padding:0;width:52px;justify-content:center}',
    '.is-open .launcher .label,.is-open .launcher .dot{display:none}',
    '.is-open .launcher .ico{display:block}',

    /* panel: animates open from the launcher's corner */
    '.panel{order:1;display:flex;flex-direction:column;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100dvh - 104px));',
    'background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:24px;overflow:hidden;box-shadow:var(--shadow);',
    'transform-origin:bottom ' + side + ';opacity:0;transform:translateY(16px) scale(.94);visibility:hidden;pointer-events:none;',
    'transition:opacity .28s var(--ease),transform .45s var(--ease),visibility 0s linear .45s}',
    '.is-open .panel{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .3s var(--ease),transform .5s var(--ease),visibility 0s}',
    '@media (prefers-reduced-motion:reduce){.panel,.launcher,.stage{transition:none!important}.launcher .dot::after{animation:none}}',

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
    '.has-messages .stage{height:132px}',
    // Square canvas centred in the stage, so the aura is never stretched as the stage resizes.
    'canvas{position:absolute;top:0;left:50%;height:100%;width:auto;aspect-ratio:1;transform:translateX(-50%);display:block}',
    '.state{position:absolute;bottom:8px;left:0;right:0;text-align:center;color:var(--fg-2);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;transition:opacity .3s}',

    '.log{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 16px 12px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin}',
    '.msg{max-width:85%;padding:9px 13px;border-radius:18px;background:var(--bubble);white-space:pre-wrap;overflow-wrap:anywhere;animation:rise .35s var(--ease) both}',
    '.msg.user{align-self:flex-end;background:var(--fg);color:var(--bg);border-bottom-right-radius:6px}',
    '.msg.agent{align-self:flex-start;border-bottom-left-radius:6px}',
    '.note{align-self:center;max-width:90%;color:var(--fg-2);font-size:13px;text-align:center;animation:rise .35s var(--ease) both}',
    '@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',

    'footer{padding:12px;border-top:1px solid var(--line);background:var(--bg-2)}',
    '.start{width:100%;height:48px;border-radius:999px;background:var(--fg);color:var(--bg);font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform .3s var(--ease),opacity .2s}',
    '.start:active{transform:scale(.98)}',
    '.start:disabled{opacity:.6;cursor:default}',
    '.controls{display:none;gap:8px;align-items:center}',
    '.live .controls{display:flex}',
    '.live .start{display:none}',
    '.field{flex:1;min-width:0;display:flex;align-items:center;height:44px;padding:0 6px 0 14px;border:1px solid var(--line);border-radius:999px;background:var(--bg)}',
    '.field input{flex:1;min-width:0;border:0;background:none;outline:none;font-size:14px}',
    '.field input::placeholder{color:var(--fg-2)}',
    '.send{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--accent);color:#0b1014;transition:transform .2s,opacity .2s}',
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
    '<button class="launcher" type="button" aria-expanded="false">' +
    '<span class="dot" aria-hidden="true"></span><span class="label">Talk to my AI assistant</span>' +
    '<span class="ico">' + icon('chevron') + '</span></button>' +
    '</div>';

  function $(sel) { return root.querySelector(sel); }
  var wrap = $('.wrap'), panel = $('.panel'), log = $('.log'), startBtn = $('.start'), input = $('input'),
    sendBtn = $('.send'), micBtn = $('.mic'), launcher = $('.launcher'), stateEl = $('.state'),
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
  var FRAG = [
    'precision highp float;',
    'uniform vec2 iResolution;uniform float iTime;',
    'uniform float uBlur,uScale,uFrequency,uAmplitude,uMix,uSpacing,uColorShift,uVariance,uSmoothing,uMode;',
    'uniform vec3 uColor;',
    'const float TAU=6.283185;',
    'vec2 randFibo(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.xx+p.yx)*p.xy);}',
    'vec3 Tonemap(vec3 x){x*=4.0;return x/(1.0+x);}',
    'float luma(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}',
    'vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));',
    'vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;',
    'return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);}',
    'vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);}',
    'vec2 turb(vec2 pos,float t,float it){mat2 rotation=mat2(0.6,-0.25,0.25,0.9);mat2 layerRotation=mat2(0.6,-0.8,0.8,0.6);',
    'float frequency=mix(2.0,15.0,uFrequency);float amplitude=uAmplitude;float animTime=t*0.1;',
    'for(int i=0;i<4;i++){vec2 rp=pos*rotation;vec2 wave=sin(frequency*rp+float(i)*animTime+it);',
    'pos+=(amplitude/frequency)*rotation[0]*wave;rotation*=layerRotation;amplitude*=mix(1.0,max(wave.x,wave.y),uVariance);frequency*=1.4;}',
    'return pos;}',
    'void main(){vec2 fragCoord=gl_FragCoord.xy;vec2 uv=fragCoord/iResolution.xy;vec3 pp=vec3(0.0);vec3 bloom=vec3(0.0);',
    'float t=iTime*0.5;vec2 pos=uv-0.5;const float IT=36.0;vec2 prevPos=turb(pos,t,-1.0/IT);float spacing=mix(1.0,TAU,uSpacing);',
    'for(float i=1.0;i<37.0;i++){float iter=i/IT;vec2 st=turb(pos,t,iter*spacing);float d=abs(length(st)-uScale);',
    'float pd=distance(st,prevPos);prevPos=st;float dynamicBlur=exp2(pd*2.0*1.4426950408889634)-1.0;',
    'float ds=smoothstep(0.0,uBlur*0.05+max(dynamicBlur*uSmoothing,0.001),d);vec3 color=uColor;',
    'if(uColorShift>0.01){vec3 hsv=rgb2hsv(color);hsv.x=fract(hsv.x+(1.0-iter)*uColorShift*0.3);color=hsv2rgb(hsv);}',
    'float invd=1.0/max(d+dynamicBlur,0.001);pp+=(ds-1.0)*color;bloom+=clamp(invd,0.0,250.0)*color;}',
    'pp*=1.0/IT;vec3 color;',
    'if(uMode<0.5){color=-pp*1.2;color+=(randFibo(fragCoord).x-0.5)/255.0;color=Tonemap(color);float alpha=luma(color)*uMix;gl_FragColor=vec4(color*uMix,alpha);}',
    'else{color=-pp;color+=(randFibo(fragCoord).x-0.5)/255.0;float b=length(color);vec3 dir=b>0.0?color/b:color;',
    'float mb=(b*2.0)/(1.0+b*2.0);color=dir*mb;float gray=dot(color,vec3(0.2,0.5,0.1));color=clamp(mix(vec3(gray),color,3.0),0.0,1.0);',
    // Drop the faint haze the dither leaves on light backgrounds.
    'float alpha=clamp((mb-0.04)*1.05,0.0,1.0)*clamp(uMix,1.0,2.0);alpha=min(alpha,1.0);gl_FragColor=vec4(color*alpha,alpha);}}',
  ].join('\n');

  // Motion per agent state, as in LiveKit's Agents UI aura.
  var STATES = {
    idle: { speed: 10, scale: 0.2, amplitude: 1.2, frequency: 0.4, brightness: [1.0, 1.0] },
    connecting: { speed: 30, scale: 0.3, amplitude: 0.5, frequency: 1.0, brightness: [0.5, 2.5] },
    listening: { speed: 20, scale: 0.3, amplitude: 1.0, frequency: 0.7, brightness: [1.5, 2.0] },
    thinking: { speed: 30, scale: 0.3, amplitude: 0.5, frequency: 1.0, brightness: [0.5, 2.5] },
    speaking: { speed: 70, scale: 0.3, amplitude: 0.75, frequency: 1.25, brightness: [1.5, 1.5] },
  };

  function hexToRgb(hex) {
    return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; });
  }

  function createAura(cv) {
    var gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    try {
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}'));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    } catch {
      return null;
    }
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var u = {};
    ['iResolution', 'iTime', 'uBlur', 'uScale', 'uFrequency', 'uAmplitude', 'uMix', 'uSpacing', 'uColorShift',
      'uVariance', 'uSmoothing', 'uMode', 'uColor'].forEach(function (n) { u[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1f(u.uBlur, 1.0);
    gl.uniform1f(u.uSpacing, 0.5);
    gl.uniform1f(u.uColorShift, 0.6);
    gl.uniform1f(u.uVariance, 0.1);
    gl.uniform1f(u.uSmoothing, 1.0);
    gl.uniform3fv(u.uColor, hexToRgb(config.accent));

    var cur = { speed: 10, scale: 0.2, amplitude: 1.2, frequency: 0.4, brightness: 1.0 };
    var target = STATES.idle, volume = 0, phase = 0, last = 0, raf = 0, running = false, mode = 0;

    function resize() {
      var dpr = Math.min(devicePixelRatio || 1, 1.5);
      var w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
      if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, cv.width, cv.height);
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      // Ease every parameter toward its state target; integrate speed into phase so a
      // state change never makes the motion jump.
      var k = 1 - Math.exp(-dt * 6);
      var lo = target.brightness[0], hi = target.brightness[1];
      var pulse = lo === hi ? lo : lo + (hi - lo) * (0.5 + 0.5 * Math.sin(now / 1000 * Math.PI / 0.35));
      var scaleTarget = agentState === 'speaking' ? 0.2 + 0.2 * Math.min(volume * 2.5, 1) : target.scale;
      cur.speed += (target.speed - cur.speed) * k;
      cur.scale += (scaleTarget - cur.scale) * (agentState === 'speaking' ? 1 - Math.exp(-dt * 18) : k);
      cur.amplitude += (target.amplitude - cur.amplitude) * k;
      cur.frequency += (target.frequency - cur.frequency) * k;
      cur.brightness += (pulse - cur.brightness) * k;
      phase += dt * cur.speed * (reducedMotion.matches ? 0.15 : 1);

      resize();
      gl.uniform2f(u.iResolution, cv.width, cv.height);
      gl.uniform1f(u.iTime, phase);
      gl.uniform1f(u.uScale, cur.scale);
      gl.uniform1f(u.uAmplitude, cur.amplitude);
      gl.uniform1f(u.uFrequency, cur.frequency);
      gl.uniform1f(u.uMix, cur.brightness);
      gl.uniform1f(u.uMode, mode);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    return {
      setState: function (s) { target = STATES[s] || STATES.idle; },
      setVolume: function (v) { volume = v; },
      setTheme: function (t) { mode = t === 'light' ? 1 : 0; },
      play: function () { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } },
      pause: function () { running = false; cancelAnimationFrame(raf); },
    };
  }

  var aura = createAura(canvas);
  if (!aura) canvas.style.display = 'none';

  /* ---------------------------------------------------- agent voice level */
  var analyser = null, levels = null, audioCtx = null;
  function watchAgentAudio(track) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var src = audioCtx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(analyser);
      levels = new Uint8Array(analyser.fftSize);
    } catch {
      analyser = null;
    }
  }
  (function sampleVolume() {
    requestAnimationFrame(sampleVolume);
    if (!analyser || !aura || agentState !== 'speaking') return;
    analyser.getByteTimeDomainData(levels);
    var sum = 0;
    for (var i = 0; i < levels.length; i++) { var x = (levels[i] - 128) / 128; sum += x * x; }
    aura.setVolume(Math.sqrt(sum / levels.length));
  })();

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

  function setLive(live) {
    wrap.classList.toggle('live', live);
    statusText.textContent = live ? 'In conversation' : 'Online';
    startBtn.disabled = false;
    startBtn.lastChild.textContent = 'Start conversation';
  }

  var greeted = false;
  function setOpen(open) {
    wrap.classList.toggle('is-open', open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.setAttribute('aria-label', open ? 'Close assistant' : 'Talk to my AI assistant');
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
      if (!resp.ok) throw new Error('The assistant is unavailable right now.');
      return resp.json();
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
        note('Conversation ended.');
        cleanup();
      });
      room.registerTextStreamHandler('lk.transcription', onTranscription);
      await room.connect(session.server_url, session.participant_token);
      await room.startAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      setLive(true);
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
