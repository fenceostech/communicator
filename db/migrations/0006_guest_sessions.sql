-- Guest access sessions. A guest enters only a name (no account, email,
-- password, or email verification) and receives a signed, restricted
-- (member-level) session cookie. This table records who accessed the shared
-- URL and when, giving the owner an audit trail of guest activity.
CREATE TABLE IF NOT EXISTS guest_sessions (
  sid          text PRIMARY KEY,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
