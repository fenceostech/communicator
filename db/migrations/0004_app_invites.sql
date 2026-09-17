-- Pending invites. The recipient sets their own password via a one-time token;
-- only the SHA-256 hash of the token is stored.
CREATE TABLE IF NOT EXISTS app_invites (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token_hash  TEXT NOT NULL,
  invited_by  TEXT NOT NULL DEFAULT '',
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_invites_token_idx ON app_invites (token_hash);
CREATE INDEX IF NOT EXISTS app_invites_email_idx ON app_invites (lower(email));
