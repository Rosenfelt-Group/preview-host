import { describe, it, expect } from "vitest";
import { BRIDGE_JS } from "./bridge";

describe("BRIDGE_JS", () => {
  it("is valid JavaScript", () => {
    expect(() => new Function(BRIDGE_JS)).not.toThrow();
  });
  it("only posts screen reports to the parent and listens for nothing", () => {
    expect(BRIDGE_JS).toContain("window.parent.postMessage");
    expect(BRIDGE_JS).toContain("type:'screen'");
    expect(BRIDGE_JS).not.toContain("fetch(");
    expect(BRIDGE_JS).not.toContain("XMLHttpRequest");
    expect(BRIDGE_JS).not.toContain("eval(");
    expect(BRIDGE_JS).not.toContain("document.cookie");
    expect(BRIDGE_JS).not.toContain("</script>");
  });
});
