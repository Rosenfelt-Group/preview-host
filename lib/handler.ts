import { verifyGrant } from "./grant";
import { safePath } from "./paths";
import { contentTypeFor } from "./mime";
import { securityHeaders } from "./headers";
import { injectBridge } from "./inject";
import { StorageError } from "./storage";

export interface HandlerDeps {
  secret: string;
  frameAncestors: string[];
  fetchObject: (objectPath: string) => Promise<{ status: number; body: ArrayBuffer } | null>;
}

const plain = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

export function makeHandler(deps: HandlerDeps) {
  const headers = securityHeaders(deps.frameAncestors);

  return async function handle(grant: string, segments: string[]): Promise<Response> {
    // Same body for every grant failure: reveal nothing about why.
    const g = verifyGrant(grant, deps.secret);
    if (!g.ok) return plain(403, "Forbidden");

    const rel = safePath(segments);
    if (!rel) return plain(404, "Not found");

    let obj: { status: number; body: ArrayBuffer } | null;
    try {
      obj = await deps.fetchObject(`${g.prefix}/${rel}`);
    } catch (e) {
      // Fixed strings only: never log e.message, the grant, prefix, path or headers.
      const what = e instanceof StorageError ? `HTTP ${e.status}` : e instanceof Error ? e.constructor.name : "unknown";
      console.error(`preview-host: storage failure (${what})`);
      return plain(502, "Bad gateway");
    }
    if (!obj || obj.status !== 200) return plain(404, "Not found");

    const type = contentTypeFor(rel);
    const isHtml = type.startsWith("text/html");
    const body = isHtml ? injectBridge(new TextDecoder("utf-8").decode(obj.body)) : obj.body;

    return new Response(body, { status: 200, headers: { ...headers, "Content-Type": type } });
  };
}
