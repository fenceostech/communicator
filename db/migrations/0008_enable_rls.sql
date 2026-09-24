-- On Supabase, tables in `public` are reachable through the Data API with the
-- public anon/publishable key. Enable RLS with no policies so that API sees
-- nothing (app_users holds password hashes). The app connects as the table
-- owner, which bypasses RLS, so its own queries are unaffected.
ALTER TABLE team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
