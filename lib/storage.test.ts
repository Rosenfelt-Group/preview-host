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

  it("returns null for HTTP 404", async () => {
    stubFetch(new Response("nope", { status: 404 }));
    expect(await fetchObject("x/y")).toBeNull();
  });

  it("returns null for HTTP 400 with a not_found body", async () => {
    stubFetch(new Response(JSON.stringify({ statusCode: "404", error: "not_found", message: "Object not found" }), { status: 400 }));
    expect(await fetchObject("x/y")).toBeNull();
    stubFetch(new Response(JSON.stringify({ statusCode: 404 }), { status: 400 }));
    expect(await fetchObject("x/y")).toBeNull();
    stubFetch(new Response(JSON.stringify({ error: "not_found" }), { status: 400 }));
    expect(await fetchObject("x/y")).toBeNull();
  });

  it("throws for HTTP 400 with another body", async () => {
    stubFetch(new Response(JSON.stringify({ statusCode: "400", error: "bad", message: "LEAKY" }), { status: 400 }));
    await expect(fetchObject("x/y")).rejects.toThrow("storage returned HTTP 400");
    stubFetch(new Response("not json", { status: 400 }));
    await expect(fetchObject("x/y")).rejects.toThrow("storage returned HTTP 400");
  });

  it.each([401, 403, 500, 503])("throws a status-only error for HTTP %i", async (status) => {
    stubFetch(new Response(`body-with-${KEY}`, { status }));
    const err = await fetchObject("x/y").catch((e) => e);
    expect(err.message).toBe(`storage returned HTTP ${status}`);
    expect(err.message).not.toContain(KEY);
  });

  it("strips trailing slashes from SUPABASE_URL", async () => {
    process.env.SUPABASE_URL = `${URL_BASE}//`;
    const f = stubFetch(new Response("ok", { status: 200 }));
    await fetchObject("a/b");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(`${URL_BASE}/storage/v1/object/prototypes/a/b`);
  });

  it("refuses redirects and sets a timeout signal", async () => {
    const f = stubFetch(new Response("ok", { status: 200 }));
    await fetchObject("a/b");
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws without leaking the key when the URL is missing", async () => {
    delete process.env.SUPABASE_URL;
    const f = stubFetch(new Response("ok"));
    const err = await fetchObject("x/y").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toContain(KEY);
    expect(f).not.toHaveBeenCalled();
  });

  it("throws when the service key is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const f = stubFetch(new Response("ok"));
    const err = await fetchObject("x/y").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toContain(URL_BASE);
    expect(f).not.toHaveBeenCalled();
  });
});
