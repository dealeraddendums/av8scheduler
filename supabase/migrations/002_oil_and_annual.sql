-- Maintenance events log (oil changes, annuals)
CREATE TABLE IF NOT EXISTS maintenance_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type          text NOT NULL CHECK (type IN ('oil_change', 'annual')),
  pilot_id      text NOT NULL,
  pilot_name    text NOT NULL,
  date          date NOT NULL,
  tach_reading  numeric(6,1) NOT NULL,
  hobbs_reading numeric(6,1),
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- Track quarts added per flight (top-up between scheduled changes)
ALTER TABLE flights ADD COLUMN IF NOT EXISTS oil_added_qts numeric(3,1) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance_events(date DESC);

ALTER TABLE maintenance_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'maintenance_events'
      AND policyname = 'allow_all_maintenance'
  ) THEN
    CREATE POLICY "allow_all_maintenance" ON maintenance_events FOR ALL USING (true);
  END IF;
END $$;
