import { makeDocHandler } from "@/lib/docs";
import { streamDocument } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ grant: string }> }) {
  const { grant } = await params;
  const secret = process.env.ROOM_GRANT_SECRET ?? "";
  if (!secret) console.error("preview-host: ROOM_GRANT_SECRET is not configured");
  return makeDocHandler({ secret, streamDocument })(grant);
}
