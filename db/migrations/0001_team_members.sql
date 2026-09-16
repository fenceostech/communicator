-- Team directory schema. Idempotent; safe to apply to any database.
CREATE TABLE IF NOT EXISTS team_members (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT 'Communication Specialist',
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'Specialist',
  initials   TEXT NOT NULL DEFAULT '',
  owns       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
