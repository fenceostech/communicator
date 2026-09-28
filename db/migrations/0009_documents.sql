-- Files attached to a subaccount (EIN / CP-575, contracts, brand assets, ...).
-- Stored in the database so they need no separate storage bucket or keys;
-- uploads are capped in the API to fit Vercel's request body limit.
CREATE TABLE IF NOT EXISTS documents (
  id          SERIAL PRIMARY KEY,
  account_id  TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'other',
  name        TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
  size        INTEGER NOT NULL,
  data        BYTEA NOT NULL,
  uploaded_by TEXT NOT NULL DEFAULT '',
  author_id   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_account_idx ON documents (account_id);

-- Same reasoning as 0008: keep it out of Supabase's public Data API.
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
