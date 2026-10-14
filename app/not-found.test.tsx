import { describe, expect, it } from "vitest";
// @ts-ignore -- @types/react-dom is not installed in this app
import { renderToStaticMarkup } from "react-dom/server";
import NotFound, { metadata } from "./not-found";

describe("not-found page", () => {
  const html = renderToStaticMarkup(<NotFound />);

  it("shows the friendly heading and copy", () => {
    expect(html).toContain("This page isn&#x27;t available here");
    expect(html).toContain("Go to the Rosably home page");
  });

  it("links to the Rosably home page", () => {
    expect(html).toContain('href="https://rosably.com"');
    expect(html).toContain('rel="noopener"');
  });

  it("has no scripts and no external resources", () => {
    expect(html).not.toContain("<script");
    const urls = html.match(/https?:\/\/[^"'\s<)]+/g) ?? [];
    expect(urls).toEqual(["https://rosably.com"]);
  });

  it("is noindex", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
