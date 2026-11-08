import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  API_BASE,
  SUPABASE_ANON_KEY,
  apiDelete,
  apiGet,
  apiPost,
  updateFlight as apiUpdateFlight,
} from '@av8/api';
import type { Flight, FlightTotals, LastReading, NewFlightInput, UpdateFlightInput } from '@av8/api';

const PAGE_SIZE = 100;

interface UseFlightsResult {
  flights: Flight[];
  totals: FlightTotals | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  error: string | null;
  refresh: () => Promise<void>;
  createFlight: (input: NewFlightInput) => Promise<Flight | null>;
  updateFlight: (id: string, updates: UpdateFlightInput) => Promise<Flight | null>;
  deleteFlight: (id: string) => Promise<boolean>;
  fetchLastReading: () => Promise<LastReading>;
  exportCSV: () => Promise<void>;
}

export function useFlights(pilotIdFilter?: string): UseFlightsResult {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [totals, setTotals] = useState<FlightTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPath = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (pilotIdFilter) params.set('pilot_id', pilotIdFilter);
      return `/flights?${params.toString()}`;
    },
    [pilotIdFilter]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const flightsPath = buildPath(0);
      console.log('[useFlights] fetching', flightsPath, '+ /flights/totals');
      const [flightsData, totalsData] = await Promise.all([
        apiGet<Flight[]>(flightsPath),
        apiGet<FlightTotals>('/flights/totals'),
      ]);
      const list = Array.isArray(flightsData) ? flightsData : [];
      setFlights(list);
      setHasMore(list.length === PAGE_SIZE);
      setTotals(totalsData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load flights';
      console.error('[useFlights] fetch failed:', err);
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [buildPath]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const page = await apiGet<Flight[]>(buildPath(flights.length));
      const list = Array.isArray(page) ? page : [];
      setFlights((prev) => {
        // Guard against duplicates if a flight was added between pages.
        const seen = new Set(prev.map((f) => f.id));
        return [...prev, ...list.filter((f) => !seen.has(f.id))];
      });
      setHasMore(list.length === PAGE_SIZE);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load more flights');
    } finally {
      setLoadingMore(false);
    }
  }, [buildPath, flights.length]);

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
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : (() => {
              try {
                return JSON.stringify(err);
              } catch {
                return 'Failed to create flight';
              }
            })();
      console.error('createFlight error:', err, 'payload:', input);
      toast.error(`Failed to create flight: ${msg}`);
      return null;
    }
  }, [refresh]);

  const updateFlight = useCallback(
    async (id: string, updates: UpdateFlightInput): Promise<Flight | null> => {
      try {
        const updated = await apiUpdateFlight(id, updates);
        toast.success('Flight updated ✓');
        await refresh();
        return updated;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update flight');
        return null;
      }
    },
    [refresh]
  );

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

  return { flights, totals, loading, loadingMore, hasMore, loadMore, error, refresh, createFlight, updateFlight, deleteFlight, fetchLastReading, exportCSV };
}
