import { describe, it, expect, vi } from "vitest";
import { makeHandler } from "./handler";
import { signGrant } from "./grant";
import { BRIDGE_JS } from "./bridge";

const E = "0b6f1c0e-2d3a-4b5c-8d7e-9f0a1b2c3d4e";
const D = "1c7a2d1f-3e4b-4c6d-9e8f-0a1b2c3d4e5f";
const SECRET = "s";
const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

function setup(files: Record<string, string | Uint8Array>, secret = SECRET) {
  const fetchObject = vi.fn(async (p: string) => {
    if (!(p in files)) return null;
    const f = files[p];
    const body = typeof f === "string" ? enc(f) : (f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer);
    return { status: 200, body };
  });
  const handle = makeHandler({ secret, frameAncestors: ["https://portal.rosably.com"], fetchObject });
  return { handle, fetchObject };
}

describe("preview handler", () => {
  it("serves a file for a valid grant, with security headers and the bridge injected", async () => {
    const { handle, fetchObject } = setup({ [`${E}/${D}/v1/index.html`]: "<body>hi</body>" });
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), ["index.html"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-security-policy")).toContain("connect-src 'none'");
    expect(res.headers.get("set-cookie")).toBeNull();
    const text = await res.text();
    expect(text).toContain(BRIDGE_JS);
    expect(text.split(BRIDGE_JS).length - 1).toBe(1);
    expect(fetchObject).toHaveBeenCalledWith(`${E}/${D}/v1/index.html`);
  });

  it("does not modify non-HTML files", async () => {
    const { handle } = setup({ [`${E}/${D}/v1/assets/app.js`]: "console.log(1)" });
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), ["assets", "app.js"]);
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await res.text()).toBe("console.log(1)");
  });

  it("returns non-HTML bytes byte-identical (no text decoding)", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x80, 0xc3, 0x28, 0x00, 0xa0]);
    const { handle } = setup({ [`${E}/${D}/v1/img.png`]: bytes });
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), ["img.png"]);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("denies bad, expired and wrong-secret grants with an identical body, without touching storage", async () => {
    const { handle, fetchObject } = setup({});
    const old = signGrant(`${E}/${D}/v1`, SECRET, Date.now() - 3_600_000);
    const forged = signGrant(`${E}/${D}/v1`, "other");
    const bodies = new Set<string>();
    for (const g of ["garbage", old, forged]) {
      const res = await handle(g, ["index.html"]);
      expect(res.status).toBe(403);
      const t = await res.text();
      expect(t).toBe("Forbidden");
      bodies.add(t);
    }
    expect(bodies.size).toBe(1);
    expect(fetchObject).not.toHaveBeenCalled();
  });

  it("denies everything when the secret is empty", async () => {
    const { handle, fetchObject } = setup({}, "");
    const res = await handle(signGrant(`${E}/${D}/v1`, "x"), ["index.html"]);
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("Forbidden");
    expect(fetchObject).not.toHaveBeenCalled();
  });

  it("cannot escape the granted prefix with dot segments", async () => {
    const { handle, fetchObject } = setup({});
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), ["..", "v2", "index.html"]);
    expect(res.status).toBe(404);
    expect(fetchObject).not.toHaveBeenCalled();
  });

  it("rejects dotfile segments without touching storage", async () => {
    const { handle, fetchObject } = setup({});
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), [".env"]);
    expect(res.status).toBe(404);
    expect(fetchObject).not.toHaveBeenCalled();
  });

  it("a v1 grant only ever reads under v1, never v2", async () => {
    const { handle, fetchObject } = setup({ [`${E}/${D}/v2/index.html`]: "secret v2" });
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), ["index.html"]);
    expect(res.status).toBe(404);
    for (const call of fetchObject.mock.calls) expect(call[0].startsWith(`${E}/${D}/v1/`)).toBe(true);
  });

  it("returns 404 for missing files", async () => {
    const { handle } = setup({});
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), ["nope.html"]);
    expect(res.status).toBe(404);
  });

  it("returns a bare 502 when storage throws", async () => {
    const fetchObject = vi.fn(async () => {
      throw new Error("boom SECRET_KEY_123 at /srv/stack");
    });
    const handle = makeHandler({ secret: SECRET, frameAncestors: [], fetchObject });
    const res = await handle(signGrant(`${E}/${D}/v1`, SECRET), ["index.html"]);
    expect(res.status).toBe(502);
    expect(await res.text()).toBe("Bad gateway");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
