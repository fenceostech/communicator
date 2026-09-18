-- "Ask the Agent" / support messages. Persisted centrally in Supabase so a
-- guest's message (sent from any browser/device) reaches the owner's inbox.
-- Sender identity is always derived from the server session, never trusted
-- from the client, so a guest cannot impersonate another sender.
CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  account_id   TEXT,
  account_name TEXT,
  body         TEXT NOT NULL,
  sender_name  TEXT NOT NULL,
  sender_type  TEXT NOT NULL DEFAULT 'guest' CHECK (sender_type IN ('guest', 'member', 'admin')),
  guest_sid    TEXT,
  author_id    INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_created_idx ON messages (created_at);
CREATE INDEX IF NOT EXISTS messages_guest_idx ON messages (guest_sid);
