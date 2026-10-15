// Reads private objects from the prototypes bucket with the service role.
// This is the only network call the preview host makes; it never queries Postgres.

// Static message with only the numeric status: never the body, URL or headers.
export class StorageError extends Error {
  constructor(public readonly status: number) {
    super(`storage returned HTTP ${status}`);
    this.name = "StorageError";
  }
}

// Supabase Storage answers 400 with {"statusCode":"404","error":"not_found"} for a missing object.
async function isMissing(res: Response): Promise<boolean> {
  if (res.status === 404) return true;
  if (res.status !== 400) return false;
  try {
    const j = (await res.json()) as { statusCode?: unknown; error?: unknown };
    return String(j?.statusCode) === "404" || j?.error === "not_found";
  } catch {
    return false;
  }
}

export async function fetchObject(objectPath: string): Promise<{ status: number; body: ArrayBuffer } | null> {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase env is not configured");
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${base}/storage/v1/object/prototypes/${encoded}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    if (await isMissing(res)) return null;
    throw new StorageError(res.status);
  }
  return { status: 200, body: await res.arrayBuffer() };
}

// Streams a private object from the room-documents bucket. The timeout bounds only the wait for
// response headers; the body is streamed to the client (Vercel's 4.5 MB limit does not apply to streams).
export async function streamDocument(objectPath: string): Promise<{ body: ReadableStream<Uint8Array>; length: string | null } | null> {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase env is not configured");
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${base}/storage/v1/object/room-documents/${encoded}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Accept-Encoding": "identity" },
      cache: "no-store",
      redirect: "error",
      signal: ctrl.signal,
    });
  } finally {
    // Timer cleared on headers: a stalled body stream is bounded by the platform function duration, by design.
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (await isMissing(res)) return null;
    throw new StorageError(res.status);
  }
  if (!res.body) throw new StorageError(502);
  // fetch transparently decompresses but keeps the upstream Content-Length, which would then be wrong.
  const length = res.headers.get("content-encoding") ? null : res.headers.get("content-length");
  return { body: res.body, length };
}
