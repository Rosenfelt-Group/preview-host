import { describe, it, expect } from "vitest";
import { safePath } from "./paths";

describe("safePath", () => {
  it("joins plain segments", () => {
    expect(safePath(["assets", "app.css"])).toBe("assets/app.css");
    expect(safePath(["index.html"])).toBe("index.html");
  });
  it("rejects traversal, dot segments, empties, backslashes, nulls and encoded escapes", () => {
    for (const bad of [
      [".."], ["assets", ".."], ["."], [""], ["a", ""], ["a\\b"], ["a\0b"], ["%2e%2e"], ["a/b"], ["..%2f"],
    ]) {
      expect(safePath(bad)).toBeNull();
    }
  });
  it("rejects dotfiles", () => {
    for (const bad of [[".env"], ["assets", ".hidden"], [".git", "config"], [".DS_Store"]]) {
      expect(safePath(bad)).toBeNull();
    }
  });
  it("rejects an empty list", () => {
    expect(safePath([])).toBeNull();
  });
});
