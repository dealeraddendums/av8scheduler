-- Destinations lookup
CREATE TABLE destinations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  icao        text NOT NULL UNIQUE,
  name        text NOT NULL,
  is_favorite boolean DEFAULT true,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Seed default destinations
INSERT INTO destinations (icao, name, sort_order) VALUES
  ('KORS', 'Orcas Island',       1),
  ('KBLI', 'Bellingham Intl',    2),
  ('KFHR', 'Friday Harbor',      3),
  ('KBVS', 'Skagit Regional',    4),
  ('KBFI', 'Boeing Field',       5),
  ('KPAE', 'Paine Field',        6),
  ('KRNT', 'Renton Muni',        7),
  ('KOLM', 'Olympia Regional',   8);

-- Flight log
CREATE TABLE flights (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pilot_id    text NOT NULL,
  pilot_name  text NOT NULL,
  date        date NOT NULL,
  destination text NOT NULL,
  hobbs_end   numeric(6,1) NOT NULL,
  tach_end    numeric(6,1) NOT NULL,
  hobbs_used  numeric(4,1),
  tach_used   numeric(4,1),
  notes       text,
  photo_url   text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_flights_date ON flights(date DESC);
CREATE INDEX idx_flights_pilot ON flights(pilot_id);

-- Enable RLS (open for now since auth is PIN-based at app layer)
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_flights" ON flights FOR ALL USING (true);
CREATE POLICY "allow_all_destinations" ON destinations FOR ALL USING (true);
