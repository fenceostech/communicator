-- Notes live in their own table so invited (member) users can add notes
-- without being able to write the shared workspace state, and so note
-- additions can't be clobbered by the owner's full-state saves.
CREATE TABLE IF NOT EXISTS notes (
  id         SERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  text       TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT '',
  author_id  INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_account_idx ON notes (account_id);
