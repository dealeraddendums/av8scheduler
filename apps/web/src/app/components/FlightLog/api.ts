import { projectId, publicAnonKey } from '/utils/supabase/info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-82b8c834`;

const authHeaders = (extra?: Record<string, string>) => ({
  Authorization: `Bearer ${publicAnonKey}`,
  ...(extra ?? {}),
});

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
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(parsed?.error ?? `POST ${path} failed: ${res.status}`);
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
