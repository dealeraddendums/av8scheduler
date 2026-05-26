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
  created_at: string;
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
  by_pilot: PilotTotals[];
  oil_due_tach: number;
  current_tach: number;
  tach_remaining: number;
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
}
