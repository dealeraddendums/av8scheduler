import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiGet, apiPost } from './api';
import type { MaintenanceEvent, NewMaintenanceInput, OilSummary } from './types';

interface UseMaintenanceEventsResult {
  events: MaintenanceEvent[];
  loading: boolean;
  refresh: () => Promise<void>;
  createEvent: (input: NewMaintenanceInput) => Promise<MaintenanceEvent | null>;
  fetchOilSummary: () => Promise<OilSummary | null>;
}

export function useMaintenanceEvents(): UseMaintenanceEventsResult {
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<MaintenanceEvent[]>('/maintenance-events');
      setEvents(data);
    } catch (err) {
      console.error('Error loading maintenance events:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load maintenance events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createEvent = useCallback(async (input: NewMaintenanceInput): Promise<MaintenanceEvent | null> => {
    try {
      const created = await apiPost<MaintenanceEvent>('/maintenance-events', input);
      const label = input.type === 'oil_change' ? 'Oil change logged ✓' : 'Annual logged ✓';
      toast.success(label);
      await refresh();
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to log maintenance';
      toast.error(msg);
      return null;
    }
  }, [refresh]);

  const fetchOilSummary = useCallback(async (): Promise<OilSummary | null> => {
    try {
      return await apiGet<OilSummary>('/oil-summary');
    } catch (err) {
      console.error('Error fetching oil summary:', err);
      return null;
    }
  }, []);

  return { events, loading, refresh, createEvent, fetchOilSummary };
}
