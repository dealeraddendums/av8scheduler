import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { fetchUsers } from '@av8/api';
import type { ScheduleUser } from '@av8/api';

const STORE_KEY = 'av8_user';

export interface AuthSession {
  id: string;
  name: string;
  color: string;
  email?: string;
}

interface UseAuthResult {
  session: AuthSession | null;
  loading: boolean;
  pilots: ScheduleUser[];
  pilotsLoading: boolean;
  refreshPilots: () => Promise<void>;
  /**
   * Validate `pin` against the user's stored PIN from the /users endpoint.
   * Matches the existing web behavior: PIN check is client-side against
   * the user record returned by /users (no dedicated /auth/verify exists).
   */
  loginWithPin: (userId: string, pin: string) => Promise<{ ok: boolean; reason?: string }>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pilots, setPilots] = useState<ScheduleUser[]>([]);
  const [pilotsLoading, setPilotsLoading] = useState(true);

  // Hydrate stored session on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as AuthSession;
          if (parsed && typeof parsed.id === 'string') setSession(parsed);
        }
      } catch (err) {
        console.warn('useAuth: failed to read stored session', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPilots = useCallback(async () => {
    setPilotsLoading(true);
    try {
      const users = await fetchUsers();
      setPilots(users.filter((u) => u.userType !== 'spouse'));
    } catch (err) {
      console.warn('useAuth: failed to fetch pilots', err);
    } finally {
      setPilotsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPilots();
  }, [refreshPilots]);

  const loginWithPin = useCallback<UseAuthResult['loginWithPin']>(async (userId, pin) => {
    // Fresh fetch to ensure we have the latest PINs.
    const users = await fetchUsers();
    const pilot = users.find((u) => u.id === userId);
    if (!pilot) return { ok: false, reason: 'Pilot not found' };
    if (!pilot.pin) return { ok: false, reason: 'PIN not set for this pilot' };
    if (pilot.pin !== pin) return { ok: false, reason: 'Incorrect PIN' };

    const sessionData: AuthSession = {
      id: pilot.id,
      name: pilot.name,
      color: pilot.color,
      email: pilot.email,
    };
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(sessionData));
    setSession(sessionData);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE_KEY);
    setSession(null);
  }, []);

  return { session, loading, pilots, pilotsLoading, refreshPilots, loginWithPin, logout };
}

/**
 * Allan is the project admin. Same rule as the web app: id===user1 OR
 * email matches allan@allantone(.com).
 */
export function isAdminSession(session: AuthSession | null): boolean {
  if (!session) return false;
  return (
    session.id === 'user1' ||
    session.id === 'user:user1' ||
    session.email === 'allan@allantone' ||
    session.email === 'allan@allantone.com'
  );
}
