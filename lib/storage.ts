// Reads private objects from the prototypes bucket with the service role.
// This is the only network call the preview host makes; it never queries Postgres.
export async function fetchObject(objectPath: string): Promise<{ status: number; body: ArrayBuffer } | null> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase env is not configured");
  const encoded = objectPath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${base}/storage/v1/object/prototypes/${encoded}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return { status: 200, body: await res.arrayBuffer() };
}
