# Architecture

## Components

**Agent worker** (`src/voice_assistant/agent`, on LiveKit Cloud) - a LiveKit
Agents worker registered under `AGENT_NAME` (default `sabith-assistant`). It is
*explicitly dispatched*: it only joins rooms that ask for it by name, so one
worker serves every channel.

- `prompts.py` renders the system prompt from `profile.py`. The prompt fixes the
  language to English, keeps replies short for speech, limits the assistant to
  the profile's facts, and stops it committing to anything on Sabith's behalf.
- `assistant.py` defines the agent and its tools: `take_message` and `end_call`.
- `realtime.py` builds the Gemini Live speech-to-speech model: server-side voice
  activity detection, barge-in interruption, and transcription of both sides.
- `worker.py` is the entrypoint. It greets the caller, and when the conversation
  ends it posts the transcript to the Worker.
- `transcript.py` converts a session report into the ingest payload. It has no
  LiveKit imports, so it is unit-tested directly.

**Cloudflare Worker** (`web/`) - one deployment that serves three things:

- the React voice UI (`web/src`) and the embed widget (`web/public/embed`), as
  static assets;
- the API (`web/worker`), a [Hono](https://hono.dev) app;
- storage, in a D1 (SQLite) database.

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /` | public | The React voice UI |
| `GET /embed/embed.js`, `GET /embed/` | public | The widget and its demo page |
| `GET /health` | public | Liveness and database connectivity |
| `POST /api/v1/token` | public | Mint a LiveKit token that starts a web session |
| `POST /api/v1/calls/ingest` | private | Store a finished conversation and transcript |
| `GET /api/v1/calls`, `GET /api/v1/calls/{id}` | private | Read stored conversations |
| `POST /api/v1/messages`, `GET /api/v1/messages` | private | Store and read messages |

Private endpoints require `Authorization: Bearer $BACKEND_API_KEY`. They fail
closed: if the Worker has no key configured they return 503 rather than serve
caller data.

**Telephony provisioning** (`src/voice_assistant/telephony/provision.py`) - an
idempotent script that rents a number and creates the SIP dispatch rule.

## How a conversation starts

**Phone.** A caller dials the LiveKit number. The dispatch rule creates a room
named `call-…` and dispatches the agent into it. The caller joins as a SIP
participant; the worker records their number as call metadata.

**Web or embedded.** The client calls `POST /api/v1/token`. The Worker creates a
random room name (`web-…`) and a short-lived token whose room configuration
dispatches the agent. The room and the agent are always chosen by the server,
never by the client. The client connects with the token and the agent joins.

In both cases the agent waits for the participant, starts the session, and
speaks first.

## Data model

Defined in `web/migrations/`.

- `call_sessions` - one row per conversation: channel (`phone` or `web`), caller,
  timing, and the raw session report.
- `transcript_items` - ordered turns, with a flag for turns the caller interrupted.
- `caller_messages` - messages taken by `take_message`. They are written during
  the conversation and linked to the `call_sessions` row when it ends.

Schema changes are new numbered files in `web/migrations/`; the deploy workflow
applies them before each deploy.

## The agent-Worker contract

The agent (Python) and the Worker (TypeScript) share one payload: the ingest
request. `contract/ingest_payload.json` is that payload. The agent's tests assert
it produces exactly this file, and the Worker's tests post the same file to the
ingest endpoint, so a change on either side fails the other's tests.
