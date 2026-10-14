import { describe, it, expect } from "vitest";
import { injectBridge } from "./inject";
import { BRIDGE_JS } from "./bridge";

describe("injectBridge", () => {
  it("inserts before </body>", () => {
    const out = injectBridge("<html><body><p>x</p></body></html>");
    expect(out.indexOf("<script>")).toBeLessThan(out.indexOf("</body>"));
    expect(out).toContain(BRIDGE_JS);
  });
  it("handles upper-case </BODY> and uses the last one", () => {
    const out = injectBridge("<BODY><div>&lt;/body&gt;</div></BODY>");
    expect(out.endsWith("</BODY>")).toBe(true);
    expect(out.indexOf(BRIDGE_JS)).toBeLessThan(out.lastIndexOf("</BODY>"));
  });
  it("appends when there is no </body>", () => {
    const out = injectBridge("<p>fragment</p>");
    expect(out.endsWith("</script>")).toBe(true);
    expect(out).toContain(BRIDGE_JS);
  });
  it("is not applied twice", () => {
    const once = injectBridge("<body></body>");
    expect(injectBridge(once)).toBe(once);
  });
});
