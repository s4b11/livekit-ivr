/*!
 * Embeddable voice + chat widget for Sabith's AI assistant.
 *
 *   <script src="https://YOUR-API-HOST/embed/embed.js" defer></script>
 *
 * Optional attributes on the script tag:
 *   data-api-base   API origin that serves POST /api/v1/token (default: this script's origin)
 *   data-title      Header text                  (default: "Sabith's AI assistant")
 *   data-accent     Accent colour                (default: "#2563eb")
 *   data-position   "right" or "left"            (default: "right")
 *
 * The widget renders in a shadow root, so host-page styles do not leak in or out.
 * It is also scriptable: window.VoiceAssistant.open() / .close() / .start() / .stop().
 */
(function () {
  "use strict";
  if (window.VoiceAssistant) return;

  var script = document.currentScript;
  var data = (script && script.dataset) || {};
  var config = {
    apiBase: (data.apiBase || (script ? new URL(script.src).origin : location.origin)).replace(/\/$/, ""),
    title: data.title || "Sabith's AI assistant",
    accent: data.accent || "#2563eb",
    position: data.position === "left" ? "left" : "right",
  };
  var SDK_URL = "https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js";

  var CSS = [
    ":host{all:initial;position:fixed;bottom:20px;" + config.position + ":20px;z-index:2147483000;",
    "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--accent:" + config.accent + ";",
    "--bg:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--bubble:#f1f5f9}",
    "@media (prefers-color-scheme:dark){:host{--bg:#0f172a;--fg:#f1f5f9;--muted:#94a3b8;--line:#1e293b;--bubble:#1e293b}}",
    "*{box-sizing:border-box}",
    "button{font:inherit;cursor:pointer;border:0}",
    "button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    ".launcher{display:flex;align-items:center;gap:8px;margin-" + (config.position === "left" ? "right" : "left") + ":auto;",
    "padding:12px 18px;border-radius:999px;background:var(--accent);color:#fff;font-size:15px;font-weight:600;",
    "box-shadow:0 8px 24px rgba(15,23,42,.25)}",
    ".panel{display:none;flex-direction:column;width:min(360px,calc(100vw - 32px));height:min(520px,calc(100vh - 110px));",
    "margin-bottom:12px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:16px;",
    "overflow:hidden;box-shadow:0 16px 48px rgba(15,23,42,.28)}",
    ".open .panel{display:flex}",
    "header{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}",
    "header strong{flex:1;font-size:15px}",
    ".dot{width:9px;height:9px;border-radius:50%;background:var(--muted)}",
    ".live .dot{background:#16a34a}",
    ".icon{background:none;color:var(--muted);font-size:20px;line-height:1;padding:2px 6px;border-radius:6px}",
    ".log{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45}",
    ".msg{max-width:85%;padding:8px 12px;border-radius:14px;background:var(--bubble);white-space:pre-wrap;overflow-wrap:anywhere}",
    ".msg.user{align-self:flex-end;background:var(--accent);color:#fff}",
    ".note{align-self:center;color:var(--muted);font-size:13px;text-align:center}",
    "footer{padding:12px;border-top:1px solid var(--line);display:flex;gap:8px}",
    ".primary{flex:1;padding:11px;border-radius:10px;background:var(--accent);color:#fff;font-weight:600}",
    ".primary:disabled{opacity:.6;cursor:default}",
    "input{flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:inherit;font-size:14px}",
    ".round{width:40px;height:40px;border-radius:50%;background:var(--bubble);color:var(--fg);font-size:16px;flex:none}",
    ".round.off{color:#dc2626}",
    ".round.end{background:#dc2626;color:#fff}",
    ".idle .live-only,.live .idle-only{display:none}",
  ].join("");

  var host = document.createElement("div");
  host.id = "voice-assistant-widget";
  var root = host.attachShadow({ mode: "open" });
  root.innerHTML =
    "<style>" + CSS + "</style>" +
    '<div class="wrap idle">' +
    '<section class="panel" role="dialog" aria-label="AI assistant">' +
    '<header><span class="dot"></span><strong></strong>' +
    '<button class="icon close" aria-label="Close">&times;</button></header>' +
    '<div class="log" aria-live="polite"></div>' +
    "<footer>" +
    '<button class="primary start idle-only">Start conversation</button>' +
    '<input class="live-only" type="text" placeholder="Type a message…" aria-label="Message" maxlength="500">' +
    '<button class="round mic live-only" aria-label="Mute microphone" title="Mute microphone">🎙</button>' +
    '<button class="round end live-only" aria-label="End conversation" title="End conversation">✕</button>' +
    "</footer></section>" +
    '<button class="launcher" aria-expanded="false">💬 <span>Talk to my AI assistant</span></button>' +
    "</div>";

  function $(sel) { return root.querySelector(sel); }
  var wrap = $(".wrap"), log = $(".log"), startBtn = $(".start"), input = $("input"),
    micBtn = $(".mic"), launcher = $(".launcher");
  $("header strong").textContent = config.title;

  var room = null, micOn = false, bubbles = {}, audioEls = [];

  function addLine(text, cls) {
    var el = document.createElement("div");
    el.className = cls;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function note(text) { return addLine(text, "note"); }

  function setLive(live) {
    wrap.classList.toggle("live", live);
    wrap.classList.toggle("idle", !live);
    startBtn.disabled = false;
    startBtn.textContent = "Start conversation";
  }

  function setOpen(open) {
    wrap.classList.toggle("open", open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open && !log.childElementCount) {
      note("Ask about Sabith's work, or leave him a message. You can talk or type.");
    }
  }

  function loadSdk() {
    if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = SDK_URL;
      s.onload = function () { resolve(window.LivekitClient); };
      s.onerror = function () { reject(new Error("Could not load the audio library.")); };
      document.head.appendChild(s);
    });
  }

  async function fetchToken() {
    var resp = await fetch(config.apiBase + "/api/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!resp.ok) throw new Error("The assistant is unavailable right now.");
    return resp.json();
  }

  // Agent speech and user speech both arrive as text streams; one bubble per segment.
  async function onTranscription(reader, participantInfo) {
    var attrs = (reader.info && reader.info.attributes) || {};
    var key = attrs["lk.segment_id"] || reader.info.id;
    var isUser = room && participantInfo.identity === room.localParticipant.identity;
    var text = "";
    for await (var chunk of reader) {
      text += chunk;
      if (!text.trim()) continue;
      if (!bubbles[key]) bubbles[key] = addLine("", "msg " + (isUser ? "user" : "agent"));
      bubbles[key].textContent = text;
      log.scrollTop = log.scrollHeight;
    }
  }

  async function setMic(enabled) {
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      micOn = enabled;
    } catch (err) {
      micOn = false;
      note("Microphone unavailable - you can still type.");
    }
    micBtn.classList.toggle("off", !micOn);
    var label = micOn ? "Mute microphone" : "Unmute microphone";
    micBtn.title = label;
    micBtn.setAttribute("aria-label", label);
  }

  function cleanup() {
    audioEls.forEach(function (el) { el.remove(); });
    audioEls = [];
    bubbles = {};
    room = null;
    setLive(false);
  }

  async function start() {
    if (room) return;
    setOpen(true);
    startBtn.disabled = true;
    startBtn.textContent = "Connecting…";
    try {
      var results = await Promise.all([loadSdk(), fetchToken()]);
      var LK = results[0], session = results[1];
      room = new LK.Room({ adaptiveStream: true, dynacast: true });
      room.on(LK.RoomEvent.TrackSubscribed, function (track) {
        if (track.kind !== "audio") return;
        var el = track.attach();
        el.style.display = "none";
        document.body.appendChild(el);
        audioEls.push(el);
      });
      room.on(LK.RoomEvent.Disconnected, function () {
        note("Conversation ended.");
        cleanup();
      });
      room.registerTextStreamHandler("lk.transcription", onTranscription);
      await room.connect(session.server_url, session.participant_token);
      await room.startAudio();
      setLive(true);
      await setMic(true);
      input.focus();
    } catch (err) {
      if (room) { try { await room.disconnect(); } catch (e) { /* already closed */ } }
      cleanup();
      note(err && err.message ? err.message : "Could not connect. Please try again.");
    }
  }

  async function stop() {
    if (room) await room.disconnect();
  }

  async function sendText() {
    var text = input.value.trim();
    if (!text || !room) return;
    input.value = "";
    addLine(text, "msg user");
    try {
      await room.localParticipant.sendText(text, { topic: "lk.chat" });
    } catch (err) {
      note("Message not sent. Please try again.");
    }
  }

  launcher.addEventListener("click", function () { setOpen(!wrap.classList.contains("open")); });
  $(".close").addEventListener("click", function () { setOpen(false); });
  startBtn.addEventListener("click", start);
  $(".end").addEventListener("click", stop);
  micBtn.addEventListener("click", function () { if (room) setMic(!micOn); });
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") sendText(); });

  function mount() { document.body.appendChild(host); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  window.VoiceAssistant = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    start: start,
    stop: stop,
  };
})();
