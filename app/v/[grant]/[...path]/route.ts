import { makeHandler } from "@/lib/handler";
import { fetchObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ grant: string; path: string[] }> },
) {
  const { grant, path } = await params;
  const handle = makeHandler({
    secret: process.env.ROOM_GRANT_SECRET ?? "",
    frameAncestors: (process.env.FRAME_ANCESTORS ?? "").split(/\s+/).filter(Boolean),
    fetchObject,
  });
  return handle(grant, path);
}
