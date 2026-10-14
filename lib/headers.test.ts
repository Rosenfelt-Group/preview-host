import { describe, it, expect } from "vitest";
import { securityHeaders } from "./headers";

describe("securityHeaders", () => {
  const h = securityHeaders(["https://portal.rosably.com", "https://dashboard.rosably.com"]);
  it("blocks all network from the prototype and restricts framing", () => {
    expect(h["Content-Security-Policy"]).toBe(
      "default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'; form-action 'none'; frame-ancestors https://portal.rosably.com https://dashboard.rosably.com",
    );
  });
  it("sets the fixed hardening headers", () => {
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["Cache-Control"]).toBe("private, max-age=300");
  });
  it("allows opaque-origin sandboxed frames to load subresources (no credentials exist)", () => {
    expect(h["Access-Control-Allow-Origin"]).toBe("*");
  });
  it("sets no cookies", () => {
    expect(Object.keys(h).map(k => k.toLowerCase())).not.toContain("set-cookie");
  });
  it("falls back to frame-ancestors 'none' when none are configured", () => {
    expect(securityHeaders([])["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
});
