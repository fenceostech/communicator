-- Team directory. Idempotent: safe to run on every boot.
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

INSERT INTO team_members (name, title, email, role, initials, owns, created_at) VALUES
  ('Ryan Malaluan', 'Founder',                 'ryan@fenceos.io',    'Owner',      'RM', 'Agency configuration', now() - interval '90 days'),
  ('Dale Whitaker', 'Estimator',               'dale@abcfence.com',  'Owner',      'DW', 'Subaccount builds',     now() - interval '60 days'),
  ('Priya Nair',    'Communication Specialist','priya@fenceos.io',   'Specialist', 'PN', 'Client messaging',      now() - interval '30 days')
ON CONFLICT (email) DO NOTHING;
