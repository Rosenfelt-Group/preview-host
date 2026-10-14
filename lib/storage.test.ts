import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchObject } from "./storage";

const URL_BASE = "https://proj.supabase.co";
const KEY = "service-key-abc123";
const saved = { u: process.env.SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };

function restore(name: string, v: string | undefined) {
  if (v === undefined) delete process.env[name];
  else process.env[name] = v;
}

beforeEach(() => {
  process.env.SUPABASE_URL = URL_BASE;
  process.env.SUPABASE_SERVICE_ROLE_KEY = KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  restore("SUPABASE_URL", saved.u);
  restore("SUPABASE_SERVICE_ROLE_KEY", saved.k);
});

function stubFetch(res: Response) {
  const f = vi.fn(async () => res);
  vi.stubGlobal("fetch", f);
  return f;
}

describe("storage fetchObject", () => {
  it("requests the bucket URL with auth headers and no-store", async () => {
    const f = stubFetch(new Response("ok", { status: 200 }));
    const out = await fetchObject("e/d/v1/index.html");
    expect(out?.status).toBe(200);
    expect(new TextDecoder().decode(out!.body)).toBe("ok");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL_BASE}/storage/v1/object/prototypes/e/d/v1/index.html`);
    const h = init.headers as Record<string, string>;
    expect(h.apikey).toBe(KEY);
    expect(h.Authorization).toBe(`Bearer ${KEY}`);
    expect(init.cache).toBe("no-store");
  });

  it("encodes each path segment", async () => {
    const f = stubFetch(new Response("ok", { status: 200 }));
    await fetchObject("a b/c#d.html");
    const [url] = f.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${URL_BASE}/storage/v1/object/prototypes/a%20b/c%23d.html`);
  });

  it("returns null for a non-ok response", async () => {
    stubFetch(new Response("nope", { status: 404 }));
    expect(await fetchObject("x/y")).toBeNull();
  });

  it("throws without leaking the key when env is missing", async () => {
    delete process.env.SUPABASE_URL;
    stubFetch(new Response("ok"));
    await expect(fetchObject("x/y")).rejects.toThrow(Error);
    try {
      await fetchObject("x/y");
    } catch (e) {
      expect((e as Error).message).not.toContain(KEY);
    }
  });
});
