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
  it("keeps the closing tag intact with characters whose lowercase changes length", () => {
    const out = injectBridge("<body>\u0130\u0130\u0130</body>");
    expect(out.endsWith("</body>")).toBe(true);
    expect(out.indexOf(BRIDGE_JS)).toBeLessThan(out.lastIndexOf("</body>"));
    expect(out.startsWith("<body>\u0130\u0130\u0130<script>")).toBe(true);
  });
  it("matches </body > and </BODY\\n>", () => {
    const a = injectBridge("<body>x</body >");
    expect(a.endsWith("</body >")).toBe(true);
    expect(a.indexOf(BRIDGE_JS)).toBeLessThan(a.lastIndexOf("</body >"));
    const b = injectBridge("<body>x</BODY\n>");
    expect(b.endsWith("</BODY\n>")).toBe(true);
    expect(b.indexOf(BRIDGE_JS)).toBeLessThan(b.lastIndexOf("</BODY"));
  });
  it("uses the last of multiple </body> occurrences", () => {
    const out = injectBridge("<body>a</body><body>b</body>");
    expect(out.startsWith("<body>a</body><body>b<script>")).toBe(true);
    expect(out.endsWith("</script></body>")).toBe(true);
  });
});
