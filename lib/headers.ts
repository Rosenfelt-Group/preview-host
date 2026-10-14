export function securityHeaders(frameAncestors: string[]): Record<string, string> {
  const ancestors = frameAncestors.length > 0 ? frameAncestors.join(" ") : "'none'";
  return {
    "Content-Security-Policy":
      `default-src 'self' 'unsafe-inline' data: blob:; connect-src 'none'; form-action 'none'; frame-ancestors ${ancestors}`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "private, max-age=300",
    // The sandboxed frame has an opaque origin, so module scripts and fonts need CORS.
    // Access is already gated by the signed grant in the URL and no credentials exist here.
    "Access-Control-Allow-Origin": "*",
  };
}
