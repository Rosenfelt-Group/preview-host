import { describe, it, expect, vi } from "vitest";
import { makeDocHandler, contentDisposition } from "./docs";
import { signDocGrant, signGrant } from "./grant";
import { StorageError } from "./storage";

const E = "0b6f1c0e-2d3a-4b5c-8d7e-9f0a1b2c3d4e";
const D = "1c7a2d1f-3e4b-4c6d-9e8f-0a1b2c3d4e5f";
const U = "2d8b3e20-4f5c-4d7e-8f90-1b2c3d4e5f60";
const SECRET = "s";
const NOW = 1_800_000_000_000;
const stream = (s: string) => new Response(s).body!;

function setup(result: { body: ReadableStream<Uint8Array>; length: string | null } | null | Error) {
  const streamDocument = vi.fn(async () => { if (result instanceof Error) throw result; return result; });
  return { handle: makeDocHandler({ secret: SECRET, streamDocument, now: () => NOW }), streamDocument };
}

describe("document handler", () => {
  it("serves an attachment with a fixed content type and hardening headers", async () => {
    const { handle, streamDocument } = setup({ body: stream("%PDF-1.7"), length: "8" });
    const res = await handle(signDocGrant(`${E}/${D}/${U}/document.pdf`, "Proposal.pdf", SECRET, NOW));
    expect(res.status).toBe(200);
    expect(streamDocument).toHaveBeenCalledWith(`${E}/${D}/${U}/document.pdf`);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="Proposal.pdf"; filename*=UTF-8''Proposal.pdf`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-length")).toBe("8");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(await res.text()).toBe("%PDF-1.7");
  });

  it("serves a markdown file as text/markdown attachment, never inline", async () => {
    const { handle } = setup({ body: stream("# hi <script>x</script>"), length: null });
    const res = await handle(signDocGrant(`${E}/${D}/${U}/document.md`, "notes.md", SECRET, NOW));
    expect(res.headers.get("content-type")).toBe("text/markdown");
    expect(res.headers.get("content-disposition")!.startsWith("attachment;")).toBe(true);
    expect(res.headers.get("content-length")).toBeNull();
  });

  it("answers every grant failure with the same 403 and never touches storage", async () => {
    const { handle, streamDocument } = setup({ body: stream("x"), length: null });
    const bodies = new Set<string>();
    for (const g of [
      "garbage",
      signDocGrant(`${E}/${D}/${U}/document.pdf`, "a.pdf", SECRET, NOW - 3_600_000),
      signDocGrant(`${E}/${D}/${U}/document.pdf`, "a.pdf", "other", NOW),
      signGrant(`${E}/${D}/v1`, SECRET, NOW),
    ]) {
      const res = await handle(g);
      expect(res.status).toBe(403);
      bodies.add(await res.text());
    }
    expect(bodies.size).toBe(1);
    expect(streamDocument).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing object and 502 for a storage failure, logging no grant or path", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const g = signDocGrant(`${E}/${D}/${U}/document.pdf`, "a.pdf", SECRET, NOW);
    expect((await setup(null).handle(g)).status).toBe(404);
    expect((await setup(new StorageError(500)).handle(g)).status).toBe(502);
    const logged = err.mock.calls.flat().join(" ");
    expect(logged).not.toContain(g);
    expect(logged).not.toContain(U);
    err.mockRestore();
  });
});

describe("contentDisposition", () => {
  it("gives an ASCII fallback and an RFC 5987 UTF-8 name", () => {
    expect(contentDisposition("Résumé – 2026.pdf")).toBe(
      `attachment; filename="R_sum_ _ 2026.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9%20%E2%80%93%202026.pdf`);
    expect(contentDisposition("a'(b)*.pdf")).toBe(`attachment; filename="a'(b)*.pdf"; filename*=UTF-8''a%27%28b%29%2A.pdf`);
  });
  it("never emits a quote, backslash, semicolon or line break inside the quoted name", () => {
    const h = contentDisposition('x";\\\r\nSet-Cookie: a=b.pdf');
    expect(h).not.toMatch(/[\r\n]/);
    expect(h.split('"').length).toBe(3);
  });
});
