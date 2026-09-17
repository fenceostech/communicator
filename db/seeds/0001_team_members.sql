-- Demo/dev seed data. Applied locally (or when SEED_DEMO=1), NOT to production
-- databases by default. See .cursor/start.sh.
INSERT INTO team_members (name, title, email, role, initials, owns, created_at) VALUES
  ('Ryan Malaluan', 'Founder',                 'ryan@fenceos.io',    'Owner',      'RM', 'Agency configuration', now() - interval '90 days'),
  ('Dale Whitaker', 'Estimator',               'dale@abcfence.com',  'Owner',      'DW', 'Subaccount builds',     now() - interval '60 days'),
  ('Priya Nair',    'Communication Specialist','priya@fenceos.io',   'Specialist', 'PN', 'Client messaging',      now() - interval '30 days')
ON CONFLICT (email) DO NOTHING;
