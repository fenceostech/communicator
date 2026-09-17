-- Shared workspace state for cross-device persistence.
-- One row per workspace key; `data` holds the serialized console state.
CREATE TABLE IF NOT EXISTS app_state (
  key        TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
