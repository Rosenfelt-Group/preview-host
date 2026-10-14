import { describe, it, expect } from "vitest";
import { contentTypeFor } from "./mime";

describe("contentTypeFor", () => {
  it("maps known extensions", () => {
    expect(contentTypeFor("index.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeFor("a/app.JS")).toBe("text/javascript; charset=utf-8");
    expect(contentTypeFor("x.css")).toBe("text/css; charset=utf-8");
    expect(contentTypeFor("x.svg")).toBe("image/svg+xml");
    expect(contentTypeFor("x.woff2")).toBe("font/woff2");
  });
  it("never guesses: unknown types are octet-stream", () => {
    expect(contentTypeFor("x.exe")).toBe("application/octet-stream");
    expect(contentTypeFor("noext")).toBe("application/octet-stream");
  });
});
