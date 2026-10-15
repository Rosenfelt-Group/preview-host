import { describe, it, expect, vi, afterEach } from "vitest";
import { makeInlineDocHandler, contentDisposition } from "./docs";
import { signDocGrant } from "./grant";
import { StorageError } from "./storage";

const E = "0b6f1c0e-2d3a-4b5c-8d7e-9f0a1b2c3d4e";
const D = "1c7a2d1f-3e4b-4c6d-9e8f-0a1b2c3d4e5f";
const U = "2d8b3e20-4f5c-4d7e-8f90-1b2c3d4e5f60";
const SECRET = "s".repeat(32);
const NOW = 1_800_000_000_000;
const path = (ext: string) => `${E}/${D}/${U}/document.${ext}`;
const grant = (ext: string, name = `Doc.${ext}`) => signDocGrant(path(ext), name, SECRET, NOW);
const body = (s = "hello") => new Response(s).body!;
const ANC = ["https://dashboard.rosably.com"];
const handler = (stream: (p: string) => Promise<{ body: ReadableStream<Uint8Array>; length: string | null } | null>) =>
  makeInlineDocHandler({ secret: SECRET, streamDocument: stream, now: () => NOW + 1000, frameAncestors: ANC });

afterEach(() => vi.restoreAllMocks());

describe("makeInlineDocHandler", () => {
  it("serves a PDF inline with the viewer-friendly CSP (no sandbox, no default-src)", async () => {
    const stream = vi.fn(async () => ({ body: body("%PDF-1.7"), length: "8" }));
    const r = await handler(stream)(grant("pdf", "Proposal.pdf"));
    expect(r.status).toBe(200);
    expect(stream).toHaveBeenCalledWith(path("pdf"));
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toMatch(/^inline; filename="Proposal\.pdf"/);
    const csp = r.headers.get("content-security-policy")!;
    expect(csp).toBe("frame-ancestors https://dashboard.rosably.com");
    expect(csp).not.toContain("sandbox");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("content-length")).toBe("8");
    expect(r.headers.get("x-frame-options")).toBeNull();
  });
  it("serves images with their type and a locked-down CSP", async () => {
    for (const [ext, type] of [["png", "image/png"], ["jpg", "image/jpeg"]] as const) {
      const r = await handler(async () => ({ body: body("x"), length: null }))(grant(ext));
      expect(r.headers.get("content-type")).toBe(type);
      expect(r.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors https://dashboard.rosably.com");
      expect(r.headers.get("x-frame-options")).toBeNull();
      expect(r.headers.get("cross-origin-resource-policy")).toBeNull();
    }
  });
  it("always serves txt, csv and md as text/plain utf-8, never html or markdown", async () => {
    for (const ext of ["txt", "csv", "md"]) {
      const r = await handler(async () => ({ body: body("<script>alert(1)</script>"), length: null }))(grant(ext));
      expect(r.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
      expect(r.headers.get("x-frame-options")).toBeNull();
      expect(r.headers.get("cross-origin-resource-policy")).toBeNull();
    }
  });
  it("sends an HTML payload named .pdf as application/pdf (type comes from the extension map)", async () => {
    const r = await handler(async () => ({ body: body("<html><script>alert(1)</script>"), length: null }))(grant("pdf"));
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });
  it("415s office formats without touching Storage", async () => {
    const stream = vi.fn();
    for (const ext of ["docx", "xlsx", "pptx"]) expect((await handler(stream)(grant(ext))).status).toBe(415);
    expect(stream).not.toHaveBeenCalled();
  });
  it("403s a bad, expired or wrong-kind grant without touching Storage", async () => {
    const stream = vi.fn();
    const h = handler(stream);
    expect((await h("garbage")).status).toBe(403);
    expect((await h(grant("pdf").slice(0, -2) + "xx")).status).toBe(403);
    const old = signDocGrant(path("pdf"), "a.pdf", SECRET, NOW - 600_000);
    expect((await h(old)).status).toBe(403);
    expect(stream).not.toHaveBeenCalled();
  });
  it("404s a missing object and 502s a storage failure with a fixed log line", async () => {
    expect((await handler(async () => null)(grant("pdf"))).status).toBe(404);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await handler(async () => { throw new StorageError(500); })(grant("pdf", "Secret Name.pdf"));
    expect(r.status).toBe(502);
    const logged = JSON.stringify(err.mock.calls);
    expect(logged).not.toContain("Secret Name");
    expect(logged).not.toContain(E);
  });
  it("error pages may still be framed by the dashboard, and use 'none' when no ancestors are configured", async () => {
    const r = await handler(async () => null)(grant("pdf"));
    expect(r.status).toBe(404);
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors https://dashboard.rosably.com");
    const forbidden = await handler(async () => null)("garbage");
    expect(forbidden.status).toBe(403);
    for (const e of [r, forbidden]) {
      expect(e.headers.get("x-frame-options")).toBeNull();
      expect(e.headers.get("cross-origin-resource-policy")).toBeNull();
      expect(e.headers.get("x-content-type-options")).toBe("nosniff");
      expect(e.headers.get("cache-control")).toBe("private, no-store");
      expect(e.headers.get("referrer-policy")).toBe("no-referrer");
    }
    const none = await makeInlineDocHandler({ secret: SECRET, streamDocument: async () => null, now: () => NOW + 1000, frameAncestors: [] })("garbage");
    expect(none.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});

describe("contentDisposition", () => {
  it("defaults to attachment and supports inline", () => {
    expect(contentDisposition("a.pdf")).toMatch(/^attachment; /);
    expect(contentDisposition("a.pdf", "inline")).toMatch(/^inline; filename="a\.pdf"; filename\*=UTF-8''a\.pdf$/);
  });
});
