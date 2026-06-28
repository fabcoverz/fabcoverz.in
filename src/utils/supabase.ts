/**
 * supabase.ts — Supabase client setup
 * All DB reads/writes go through this client.
 */

const SUPABASE_URL = "https://rrirrmjfdocqtfifzuiz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyaXJybWpmZG9jcXRmaWZ6dWl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTM5ODYsImV4cCI6MjA5NTUyOTk4Nn0.HySXwvFYB-94rbv_9Udveq-nUZP9QQriUNvjoKTfa18";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface QueryOptions {
  select?: string;
  filters?: string;   // raw PostgREST filter, e.g. "id=eq.abc"
  order?: string;     // e.g. "created_at.desc"
  single?: boolean;
}

async function supaFetch<T>(
  table: string,
  method: Method = "GET",
  body?: unknown,
  opts: QueryOptions = {}
): Promise<T> {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const params = new URLSearchParams();
  if (opts.select) params.set("select", opts.select);
  if (opts.filters) {
    // filters format: "column=operator.value" e.g. "status=eq.pending"
    // PostgREST expects it as a query param: ?column=operator.value
    const eqIdx = opts.filters.indexOf("=");
    if (eqIdx > -1) {
      const key = opts.filters.slice(0, eqIdx);
      const val = opts.filters.slice(eqIdx + 1);
      params.set(key, val);
    }
  }
  if (opts.order) params.set("order", opts.order);
  const qs = params.toString();
  if (qs) url += "?" + qs;

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
  if (opts.single) headers["Accept"] = "application/vnd.pgrst.object+json";
  if (method === "POST") headers["Prefer"] = "return=representation";
  if (method === "PATCH") headers["Prefer"] = "return=representation";

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${err}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Generic CRUD helpers ───────────────────────────────────────────────────────

export async function sbGetAll<T>(table: string, order?: string): Promise<T[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  if (order) url += `&order=${order}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`sbGetAll ${table}: ${res.status}`);
  return res.json();
}

export async function sbGetOne<T>(table: string, id: string): Promise<T | null> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows: T[] = await res.json();
  return rows[0] ?? null;
}

export async function sbUpsert<T>(table: string, data: T): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sbUpsert ${table}: ${res.status} ${err}`);
  }
}

export async function sbUpsertMany<T>(table: string, data: T[]): Promise<void> {
  if (data.length === 0) return;
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sbUpsertMany ${table}: ${res.status} ${err}`);
  }
}

export async function sbUpdate<T>(table: string, id: string, data: Partial<T>): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sbUpdate ${table}: ${res.status} ${err}`);
  }
}

export async function sbDelete(table: string, id: string): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sbDelete ${table}: ${res.status} ${err}`);
  }
}
