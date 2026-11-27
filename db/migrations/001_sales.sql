CREATE TABLE IF NOT EXISTS sales (
  actor_id text NOT NULL,
  id uuid NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_id,id)
);
