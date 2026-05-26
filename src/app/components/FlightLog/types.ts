export interface Flight {
  id: string;
  pilot_id: string;
  pilot_name: string;
  date: string;
  destination: string;
  hobbs_end: number;
  tach_end: number;
  hobbs_used: number | null;
  tach_used: number | null;
  notes: string | null;
  photo_url: string | null;
  oil_added_qts: number | null;
  created_at: string;
}

export interface MaintenanceEvent {
  id: string;
  type: 'oil_change' | 'annual';
  pilot_id: string;
  pilot_name: string;
  date: string;
  tach_reading: number;
  hobbs_reading: number | null;
  notes: string | null;
  created_at: string;
}

export interface OilSummary {
  last_oil_change: { date: string; tach: number } | null;
  oil_due_tach: number;
  tach_remaining: number;
  quarts_added_since_change: number;
  flights_since_change: number;
  hobbs_since_change: number;
}

export interface PilotTotals {
  pilot_id: string;
  pilot_name: string;
  hobbs: number;
  tach: number;
  count: number;
}

export interface FlightTotals {
  total_hobbs: number;
  total_tach: number;
  since_annual_hobbs: number;
  since_annual_tach: number;
  annual_date: string;
  annual_hobbs: number;
  annual_tach: number;
  next_annual: string;
  by_pilot: PilotTotals[];
  oil_due_tach: number;
  current_hobbs: number;
  current_tach: number;
  tach_remaining: number;
  oil_summary: OilSummary;
}

export interface Destination {
  id: string;
  icao: string;
  name: string;
  is_favorite: boolean;
  sort_order: number;
  created_at: string;
}

export interface LastReading {
  hobbs_end: number;
  tach_end: number;
}

export interface GaugeReading {
  hobbs: number | null;
  tach: number | null;
  confidence: 'high' | 'low';
}

export interface NewFlightInput {
  pilot_id: string;
  pilot_name: string;
  date: string;
  destination: string;
  hobbs_end: number;
  tach_end: number;
  notes?: string | null;
  oil_added_qts?: number;
}

export interface NewMaintenanceInput {
  type: 'oil_change' | 'annual';
  pilot_id: string;
  pilot_name: string;
  date: string;
  tach_reading: number;
  hobbs_reading?: number | null;
  notes?: string | null;
}
