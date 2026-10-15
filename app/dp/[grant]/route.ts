import { makeInlineDocHandler } from "@/lib/docs";
import { parseFrameAncestors } from "@/lib/ancestors";
import { streamDocument } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ grant: string }> }) {
  const { grant } = await params;
  const secret = process.env.ROOM_GRANT_SECRET ?? "";
  if (!secret) console.error("preview-host: ROOM_GRANT_SECRET is not configured");
  const { origins } = parseFrameAncestors(process.env.FRAME_ANCESTORS);
  if (origins.length === 0) console.error("preview-host: FRAME_ANCESTORS is empty or invalid; embedding will be refused");
  return makeInlineDocHandler({ secret, streamDocument, frameAncestors: origins })(grant);
}
