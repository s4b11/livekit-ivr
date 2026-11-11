# Embedding the assistant

## Web app

`web/` is a full-page React voice UI built with LiveKit's
[Agents UI](https://docs.livekit.io/frontends/agents-ui/) components: the Aura
audio visualizer, which reacts to the assistant's state and voice, and a control
bar with mute, chat, and end buttons. The chat button opens a live transcript
and a text input.

```bash
cd web && npm install && npm run dev
```

In development, Vite proxies `/api` to the API service on port 8000. For
production, `Dockerfile.api` builds the app and the API service serves it at
`/app/`. To host it elsewhere, set `VITE_API_BASE` to the API's origin at build
time and adjust `base` in `web/vite.config.ts`.

The components under `web/src/components/agents-ui` and `web/src/components/ui`
are installed with the shadcn CLI and kept as shipped. Update one with
`npx shadcn@latest add @agents-ui/<name> --overwrite`.

## Website widget

Add one tag to any page, pointing at your API service:

```html
<script src="https://YOUR-API-HOST/embed/embed.js" defer></script>
```

A chat bubble appears in the corner. Visitors can talk or type; the transcript
of both sides appears live. The widget renders inside a shadow root, so it does
not affect, and is not affected by, the page's styles.

| Attribute | Default | Purpose |
| --- | --- | --- |
| `data-api-base` | the script's own origin | Origin that serves `POST /api/v1/token` |
| `data-title` | `Sabith's AI assistant` | Header text |
| `data-accent` | `#2563eb` | Accent colour |
| `data-position` | `right` | `right` or `left` |

It can also be driven from your own buttons:

```js
VoiceAssistant.open();   // show the panel
VoiceAssistant.start();  // show the panel and start the conversation
VoiceAssistant.stop();   // end the conversation
VoiceAssistant.close();  // hide the panel
```

Browsers only allow microphone access on `https://` pages (and `localhost`).
If the visitor declines the microphone, text chat still works.

Restrict which sites may embed the widget with `EMBED_ALLOWED_ORIGINS` on the
API service. A demo page is served at `/embed/`.

## Your own client

`POST /api/v1/token` follows LiveKit's
[standard token endpoint](https://docs.livekit.io/frontends/build/authentication/endpoint/)
response, so it works with any LiveKit SDK - web, iOS, Android, Flutter, React Native.

```bash
curl -X POST https://YOUR-API-HOST/api/v1/token \
  -H "Content-Type: application/json" \
  -d '{"participant_name": "Alice"}'
```

```json
{
  "server_url": "wss://your-project.livekit.cloud",
  "participant_token": "eyJ…",
  "room_name": "web-3f9a1c2b7d4e",
  "participant_identity": "visitor-1a2b3c4d"
}
```

Connect to `server_url` with `participant_token`. The assistant is dispatched
into the room automatically and speaks first. Tokens are valid for ten minutes
and admit one participant to one private room.

- **Voice:** publish the microphone track.
- **Text:** send a text stream on the `lk.chat` topic.
- **Transcripts:** read text streams on the `lk.transcription` topic.

## Another voice platform

To hand calls to the assistant from an existing phone system, point a SIP trunk
at your LiveKit project and add a dispatch rule that names the agent - see
LiveKit's [telephony docs](https://docs.livekit.io/telephony/). The same worker
handles those calls with no code change.
