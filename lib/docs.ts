import { verifyDocGrant, DOC_TYPES, type DocExt } from "./grant";
import { StorageError } from "./storage";

export interface DocDeps {
  secret: string;
  streamDocument: (objectPath: string) => Promise<{ body: ReadableStream<Uint8Array>; length: string | null } | null>;
  now?: () => number;
}

// Downloads are never rendered here: attachment + nosniff + a sandboxing CSP, and the type comes
// from our extension map, never from Storage metadata.
const DOC_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

const plain = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { ...DOC_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" },
  });

export function contentDisposition(filename: string, disposition: "attachment" | "inline" = "attachment"): string {
  const ascii = filename.replace(/[^\x20-\x7e]|["\\;]/g, "_");
  const utf8 = encodeURIComponent(filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

export function makeDocHandler(deps: DocDeps) {
  return async function handle(grant: string): Promise<Response> {
    const g = verifyDocGrant(grant, deps.secret, deps.now ? deps.now() : Date.now());
    if (!g.ok) return plain(403, "Forbidden");
    let obj: { body: ReadableStream<Uint8Array>; length: string | null } | null;
    try {
      obj = await deps.streamDocument(g.path);
    } catch (e) {
      // Fixed strings only: never log e.message, the grant, path or filename.
      const what = e instanceof StorageError ? `HTTP ${e.status}` : e instanceof Error ? e.constructor.name : "unknown";
      console.error(`preview-host: document storage failure (${what})`);
      return plain(502, "Bad gateway");
    }
    if (!obj) return plain(404, "Not found");
    // safe: verifyDocGrant's anchored path regex guarantees the extension is a DocExt
    const ext = g.path.slice(g.path.lastIndexOf(".") + 1) as DocExt;
    const headers: Record<string, string> = {
      ...DOC_HEADERS,
      "Content-Type": DOC_TYPES[ext],
      "Content-Disposition": contentDisposition(g.filename),
    };
    if (obj.length && /^\d{1,9}$/.test(obj.length)) headers["Content-Length"] = obj.length;
    return new Response(obj.body, { status: 200, headers });
  };
}

// Inline viewing for the dashboard (staff): the types a browser can show safely. Office formats are
// never served inline. Text types are always text/plain (a .md is NOT rendered, a .csv is not HTML).
const INLINE_TYPES: Partial<Record<DocExt, string>> = {
  pdf: DOC_TYPES.pdf, png: DOC_TYPES.png, jpg: DOC_TYPES.jpg,
  txt: "text/plain; charset=utf-8", csv: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8",
};

export function makeInlineDocHandler(deps: DocDeps & { frameAncestors: string[] }) {
  const ancestors = deps.frameAncestors.length > 0 ? deps.frameAncestors.join(" ") : "'none'";
  // Errors may be framed by the same origins as the file, so the dashboard shows them instead of a blank frame.
  const plainFramed = (status: number, text: string) =>
    new Response(text, {
      status,
      headers: { ...DOC_HEADERS, "Content-Type": "text/plain; charset=utf-8", "Content-Security-Policy": `default-src 'none'; frame-ancestors ${ancestors}` },
    });
  return async function handle(grant: string): Promise<Response> {
    const g = verifyDocGrant(grant, deps.secret, deps.now ? deps.now() : Date.now());
    if (!g.ok) return plainFramed(403, "Forbidden");
    // safe: verifyDocGrant's anchored path regex guarantees the extension is a DocExt
    const ext = g.path.slice(g.path.lastIndexOf(".") + 1) as DocExt;
    const type = INLINE_TYPES[ext];
    if (!type) return plainFramed(415, "This file type can't be previewed.");
    let obj: { body: ReadableStream<Uint8Array>; length: string | null } | null;
    try {
      obj = await deps.streamDocument(g.path);
    } catch (e) {
      // Fixed strings only: never log e.message, the grant, path or filename.
      const what = e instanceof StorageError ? `HTTP ${e.status}` : e instanceof Error ? e.constructor.name : "unknown";
      console.error(`preview-host: inline document storage failure (${what})`);
      return plainFramed(502, "Bad gateway");
    }
    if (!obj) return plainFramed(404, "Not found");
    const headers: Record<string, string> = {
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      // A PDF needs the browser's own viewer, which a restrictive default-src or a sandbox can break;
      // every other inline type is inert data under default-src 'none'.
      "Content-Security-Policy": ext === "pdf" ? `frame-ancestors ${ancestors}` : `default-src 'none'; frame-ancestors ${ancestors}`,
      "Content-Type": type,
      "Content-Disposition": contentDisposition(g.filename, "inline"),
    };
    if (obj.length && /^\d{1,9}$/.test(obj.length)) headers["Content-Length"] = obj.length;
    return new Response(obj.body, { status: 200, headers });
  };
}
