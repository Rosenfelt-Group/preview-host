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
