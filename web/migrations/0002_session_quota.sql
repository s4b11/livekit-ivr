-- Daily session allowance per visitor (hashed IP) or caller (phone number).
CREATE TABLE session_quota (
  key   TEXT NOT NULL,          -- "ip:<sha-256>" or "phone:<sha-256>"
  day   TEXT NOT NULL,          -- UTC date, YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, day)
);
CREATE INDEX idx_session_quota_day ON session_quota (day);
