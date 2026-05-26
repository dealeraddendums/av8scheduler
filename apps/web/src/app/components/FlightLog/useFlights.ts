import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  API_BASE,
  SUPABASE_ANON_KEY,
  apiDelete,
  apiGet,
  apiPost,
} from '@av8/api';
import type { Flight, FlightTotals, LastReading, NewFlightInput } from '@av8/api';

interface UseFlightsResult {
  flights: Flight[];
  totals: FlightTotals | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createFlight: (input: NewFlightInput) => Promise<Flight | null>;
  deleteFlight: (id: string) => Promise<boolean>;
  fetchLastReading: () => Promise<LastReading>;
  exportCSV: () => Promise<void>;
}

export function useFlights(pilotIdFilter?: string): UseFlightsResult {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [totals, setTotals] = useState<FlightTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const flightsPath = pilotIdFilter
        ? `/flights?pilot_id=${encodeURIComponent(pilotIdFilter)}`
        : '/flights';
      const [flightsData, totalsData] = await Promise.all([
        apiGet<Flight[]>(flightsPath),
        apiGet<FlightTotals>('/flights/totals'),
      ]);
      setFlights(flightsData);
      setTotals(totalsData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load flights';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pilotIdFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createFlight = useCallback(async (input: NewFlightInput): Promise<Flight | null> => {
    try {
      const created = await apiPost<Flight>('/flights', input);
      toast.success('Flight logged ✓');
      await refresh();
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create flight';
      toast.error(msg);
      return null;
    }
  }, [refresh]);

  const deleteFlight = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiDelete<{ success: true }>(`/flights/${encodeURIComponent(id)}`);
      toast.success('Flight deleted');
      await refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete flight');
      return false;
    }
  }, [refresh]);

  const fetchLastReading = useCallback(async (): Promise<LastReading> => {
    try {
      return await apiGet<LastReading>('/flights/last-reading');
    } catch (err) {
      console.error('Error fetching last reading:', err);
      return { hobbs_end: 0, tach_end: 0 };
    }
  }, []);

  const exportCSV = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/flights/export?format=csv`, {
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `n4368v-flights-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export CSV');
    }
  }, []);

  return { flights, totals, loading, error, refresh, createFlight, deleteFlight, fetchLastReading, exportCSV };
}
