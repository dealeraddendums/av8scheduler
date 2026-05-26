import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost } from '@av8/api';
import type { Destination } from '@av8/api';

interface UseDestinationsResult {
  destinations: Destination[];
  loading: boolean;
  refresh: () => Promise<void>;
  createDestination: (icao: string, name: string) => Promise<Destination | null>;
  deleteDestination: (id: string) => Promise<boolean>;
}

export function useDestinations(): UseDestinationsResult {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Destination[]>('/destinations');
      setDestinations(data);
    } catch (err) {
      console.error('Error loading destinations:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load destinations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createDestination = useCallback(async (icao: string, name: string): Promise<Destination | null> => {
    try {
      const created = await apiPost<Destination>('/destinations', { icao, name });
      toast.success(`Added ${created.icao}`);
      await refresh();
      return created;
    } catch (err) {
      console.error('Error creating destination:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add destination');
      return null;
    }
  }, [refresh]);

  const deleteDestination = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiDelete<{ success: true }>(`/destinations/${encodeURIComponent(id)}`);
      toast.success('Destination removed');
      await refresh();
      return true;
    } catch (err) {
      console.error('Error deleting destination:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove destination');
      return false;
    }
  }, [refresh]);

  return { destinations, loading, refresh, createDestination, deleteDestination };
}
