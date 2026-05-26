// Shared API surface for the AV8 Scheduler. Plain fetch functions only — no
// React hooks. Each app (web, ios) wraps these in its own hook layer.
//
// The Supabase anon key is intentionally embedded here: it is the anon role
// JWT, which is designed to ship to clients (the service role key, which is
// privileged, is never in this file). Same key is also in apps/web/utils
// /supabase/info.tsx for legacy non-flight-log calls.

// ── Types ────────────────────────────────────────────────────────────────

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

export interface PilotTotals {
  pilot_id: string;
  pilot_name: string;
  hobbs: number;
  tach: number;
  count: number;
}

export interface OilSummary {
  last_oil_change: { date: string; tach: number } | null;
  oil_due_tach: number;
  tach_remaining: number;
  quarts_added_since_change: number;
  flights_since_change: number;
  hobbs_since_change: number;
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

/** User-spec alias — the spec called the totals type `Totals`. Both work. */
export type Totals = FlightTotals;

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

// ── Constants ────────────────────────────────────────────────────────────

export const PROJECT_ID = 'gigaittsnznvzppfqqer';
export const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-82b8c834`;
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZ2FpdHRzbnpudnpwcGZxcWVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzkxNTcsImV4cCI6MjA4Nzk1NTE1N30._y4mYSEkROtwX5lQySsxBHD4fg8gPvVDdch7NS4j6no';

// ── Low-level helpers ────────────────────────────────────────────────────

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, ...(extra ?? {}) };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const errMsg =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `POST ${path} failed: ${res.status}`;
    throw new Error(errMsg);
  }
  return parsed as T;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`DELETE ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Flights ──────────────────────────────────────────────────────────────

export async function fetchFlights(pilotId?: string): Promise<Flight[]> {
  const path = pilotId ? `/flights?pilot_id=${encodeURIComponent(pilotId)}` : '/flights';
  return apiGet<Flight[]>(path);
}

export async function createFlight(payload: NewFlightInput): Promise<Flight> {
  return apiPost<Flight>('/flights', payload);
}

export async function deleteFlight(id: string): Promise<void> {
  await apiDelete<{ success: true }>(`/flights/${encodeURIComponent(id)}`);
}

export async function fetchTotals(): Promise<FlightTotals> {
  return apiGet<FlightTotals>('/flights/totals');
}

export async function fetchLastReading(): Promise<LastReading> {
  return apiGet<LastReading>('/flights/last-reading');
}

// ── Destinations ─────────────────────────────────────────────────────────

export async function fetchDestinations(): Promise<Destination[]> {
  return apiGet<Destination[]>('/destinations');
}

export async function createDestination(icao: string, name: string): Promise<Destination> {
  return apiPost<Destination>('/destinations', { icao, name });
}

export async function deleteDestination(id: string): Promise<void> {
  await apiDelete<{ success: true }>(`/destinations/${encodeURIComponent(id)}`);
}

// ── Maintenance events ───────────────────────────────────────────────────

export async function fetchMaintenanceEvents(): Promise<MaintenanceEvent[]> {
  return apiGet<MaintenanceEvent[]>('/maintenance-events');
}

export async function createMaintenanceEvent(payload: NewMaintenanceInput): Promise<MaintenanceEvent> {
  return apiPost<MaintenanceEvent>('/maintenance-events', payload);
}

export async function fetchOilSummary(): Promise<OilSummary> {
  return apiGet<OilSummary>('/oil-summary');
}

// ── AI gauge reading ─────────────────────────────────────────────────────

export async function readGauges(base64: string, mediaType: string): Promise<GaugeReading> {
  return apiPost<GaugeReading>('/read-gauges', { image_base64: base64, media_type: mediaType });
}

// ── CSV export ───────────────────────────────────────────────────────────

/** Returns the CSV body as a string. Consumers convert to Blob/File and save. */
export async function exportCSV(): Promise<string> {
  const res = await fetch(`${API_BASE}/flights/export?format=csv`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.text();
}

// ── Users (read-only — primarily for iOS PIN-based auth) ─────────────────

export interface ScheduleUser {
  id: string;
  name: string;
  email: string;
  color: string;
  pin?: string;
  userType?: 'pilot' | 'spouse';
}

export async function fetchUsers(): Promise<ScheduleUser[]> {
  return apiGet<ScheduleUser[]>('/users');
}
