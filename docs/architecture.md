# Architecture

## Components

**Agent worker** (`voice_assistant.agent`) - a LiveKit Agents worker registered
under `AGENT_NAME` (default `sabith-assistant`). It is *explicitly dispatched*:
it only joins rooms that ask for it by name, so one worker serves every channel.

- `prompts.py` renders the system prompt from `profile.py`. The prompt fixes the
  language to English, keeps replies short for speech, limits the assistant to
  the profile's facts, and stops it committing to anything on Sabith's behalf.
- `assistant.py` defines the agent and its tools: `take_message` and `end_call`.
- `realtime.py` builds the Gemini Live speech-to-speech model: server-side voice
  activity detection, barge-in interruption, and transcription of both sides.
- `worker.py` is the entrypoint. It greets the caller, and when the conversation
  ends it posts the transcript to the API service.
- `transcript.py` converts a session report into the API's ingest payload. It has
  no LiveKit imports, so it is unit-tested directly.

**API service** (`voice_assistant.api`) - a FastAPI app backed by PostgreSQL.

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /health` | public | Liveness and database connectivity |
| `POST /api/v1/token` | public | Mint a LiveKit token that starts a web session |
| `GET /embed/embed.js`, `GET /embed/` | public | The widget and its demo page |
| `GET /app/` | public | The React voice UI, when built into the image |
| `POST /api/v1/calls/ingest` | private | Store a finished conversation and transcript |
| `GET /api/v1/calls`, `GET /api/v1/calls/{id}` | private | Read stored conversations |
| `POST /api/v1/messages`, `GET /api/v1/messages` | private | Store and read messages |
| `GET /api/v1/telephony/status` | private | Agent name, phone number, dispatch rules |

Private endpoints require `Authorization: Bearer $BACKEND_API_KEY` when that
setting is non-empty. Set it on any deployment that is reachable from the internet.

**Telephony provisioning** (`voice_assistant.telephony.provision`) - an
idempotent script that rents a number and creates the SIP dispatch rule.

## How a conversation starts

**Phone.** A caller dials the LiveKit number. The dispatch rule creates a room
named `call-…` and dispatches the agent into it. The caller joins as a SIP
participant; the worker records their number as call metadata.

**Web or embedded.** The client calls `POST /api/v1/token`. The API creates a
random room name (`web-…`) and a short-lived token whose room configuration
dispatches the agent. The room and the agent are always chosen by the server,
never by the client. The client connects with the token and the agent joins.

In both cases the worker waits for the participant, starts the session, and
speaks first.

## Data model

- `call_sessions` - one row per conversation: channel (`phone` or `web`), caller,
  timing, and the raw session report.
- `transcript_items` - ordered turns, with a flag for turns the caller interrupted.
- `caller_messages` - messages taken by `take_message`. They are written during
  the conversation and linked to the `call_sessions` row when it ends.

Tables are created on startup. There are no migrations yet, so a change to
`models.py` needs a manual `ALTER TABLE` or a fresh database.
