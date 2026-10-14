import { describe, it, expect } from "vitest";
import { parseFrameAncestors } from "./ancestors";

describe("parseFrameAncestors", () => {
  it("splits on whitespace", () => {
    expect(parseFrameAncestors("https://a.com https://b.com").origins).toEqual(["https://a.com", "https://b.com"]);
  });
  it("splits on commas", () => {
    const r = parseFrameAncestors("https://a.com,https://b.com, https://c.com:8443");
    expect(r.origins).toEqual(["https://a.com", "https://b.com", "https://c.com:8443"]);
    expect(r.warnings).toEqual([]);
  });
  it("lowercases", () => {
    expect(parseFrameAncestors("HTTPS://Portal.Rosably.com").origins).toEqual(["https://portal.rosably.com"]);
  });
  it("drops invalid entries with fixed warnings that never echo the value", () => {
    const bad = ["http://a.com", "https://*.a.com", "https://a.com/path", "'none'", '"https://a.com"', "https://a.com;x", "*"];
    const r = parseFrameAncestors(["https://ok.com", ...bad].join(" "));
    expect(r.origins).toEqual(["https://ok.com"]);
    expect(r.warnings.length).toBe(bad.length);
    for (const w of r.warnings) for (const b of bad) expect(w).not.toContain(b);
  });
  it("returns [] plus a warning for undefined or empty", () => {
    for (const v of [undefined, "", "  , "]) {
      const r = parseFrameAncestors(v);
      expect(r.origins).toEqual([]);
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });
});
