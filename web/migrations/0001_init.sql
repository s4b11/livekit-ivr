-- Conversations handled by the assistant, their transcripts, and messages taken.

CREATE TABLE call_sessions (
  id               TEXT PRIMARY KEY,
  room_name        TEXT NOT NULL,
  agent_name       TEXT NOT NULL DEFAULT '',
  channel          TEXT NOT NULL DEFAULT 'unknown', -- phone | web | unknown
  caller_number    TEXT NOT NULL DEFAULT 'unknown',
  called_number    TEXT NOT NULL DEFAULT '',
  sip_call_id      TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'completed',
  started_at       TEXT,
  ended_at         TEXT,
  duration_seconds REAL,
  report           TEXT, -- raw session report, JSON
  created_at       TEXT NOT NULL
);
CREATE INDEX idx_call_sessions_room ON call_sessions (room_name);
CREATE INDEX idx_call_sessions_created ON call_sessions (created_at);

CREATE TABLE transcript_items (
  id          TEXT PRIMARY KEY,
  call_id     TEXT NOT NULL REFERENCES call_sessions (id) ON DELETE CASCADE,
  idx         INTEGER NOT NULL,
  role        TEXT NOT NULL, -- user | assistant | tool_call | tool_output
  content     TEXT NOT NULL DEFAULT '',
  interrupted INTEGER NOT NULL DEFAULT 0,
  timestamp   TEXT
);
CREATE INDEX idx_transcript_items_call ON transcript_items (call_id, idx);

-- Written mid-conversation by the take_message tool, before the call row exists;
-- linked to it by room name when the conversation ends.
CREATE TABLE caller_messages (
  id          TEXT PRIMARY KEY,
  call_id     TEXT REFERENCES call_sessions (id) ON DELETE SET NULL,
  room_name   TEXT NOT NULL DEFAULT '',
  caller_name TEXT NOT NULL DEFAULT '',
  contact     TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_caller_messages_room ON caller_messages (room_name);
CREATE INDEX idx_caller_messages_created ON caller_messages (created_at);
