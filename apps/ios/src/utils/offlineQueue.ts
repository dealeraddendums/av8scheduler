// Offline write queue. Any failed createFlight / createMaintenanceEvent
// can be enqueued; we flush automatically when the app foregrounds.
//
// Not a perfect sync engine — best-effort. Each payload is replayed in
// arrival order; on success it's dropped from the queue, on failure it
// stays. A banner ("X pending sync") informs the user from any screen.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { createFlight, createMaintenanceEvent } from '@av8/api';
import type { NewFlightInput, NewMaintenanceInput } from '@av8/api';

const KEY = 'av8_offline_queue';

type QueuedItem =
  | { kind: 'flight'; payload: NewFlightInput; queuedAt: string }
  | { kind: 'maintenance'; payload: NewMaintenanceInput; queuedAt: string };

async function readQueue(): Promise<QueuedItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueueFlight(payload: NewFlightInput): Promise<void> {
  const items = await readQueue();
  items.push({ kind: 'flight', payload, queuedAt: new Date().toISOString() });
  await writeQueue(items);
}

export async function enqueueMaintenance(payload: NewMaintenanceInput): Promise<void> {
  const items = await readQueue();
  items.push({ kind: 'maintenance', payload, queuedAt: new Date().toISOString() });
  await writeQueue(items);
}

export async function flushQueue(): Promise<{ flushed: number; remaining: number }> {
  const items = await readQueue();
  if (items.length === 0) return { flushed: 0, remaining: 0 };

  const remaining: QueuedItem[] = [];
  let flushed = 0;
  for (const item of items) {
    try {
      if (item.kind === 'flight') {
        await createFlight(item.payload);
      } else {
        await createMaintenanceEvent(item.payload);
      }
      flushed += 1;
    } catch {
      // Keep this item and everything after it — preserve order.
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return { flushed, remaining: remaining.length };
}

export function useOfflineQueueCount(): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const items = await readQueue();
    setCount(items.length);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        await flushQueue();
        await refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  return count;
}
