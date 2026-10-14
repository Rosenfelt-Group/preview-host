import { makeHandler } from "@/lib/handler";
import { fetchObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ grant: string; path: string[] }> },
) {
  const { grant, path } = await params;
  const secret = process.env.ROOM_GRANT_SECRET ?? "";
  if (!secret) console.error("preview-host: ROOM_GRANT_SECRET is not configured");
  const handle = makeHandler({
    secret,
    frameAncestors: (process.env.FRAME_ANCESTORS ?? "").split(/\s+/).filter(Boolean),
    fetchObject,
  });
  return handle(grant, path);
}
