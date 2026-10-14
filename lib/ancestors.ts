const ORIGIN_RE = /^https:\/\/[a-z0-9.-]+(:\d+)?$/;

// Parses FRAME_ANCESTORS. Warnings are fixed strings: a bad value is never echoed.
export function parseFrameAncestors(raw: string | undefined): { origins: string[]; warnings: string[] } {
  const origins: string[] = [];
  const warnings: string[] = [];
  for (const part of (raw ?? "").split(/[\s,]+/)) {
    if (!part) continue;
    const o = part.toLowerCase();
    if (ORIGIN_RE.test(o)) origins.push(o);
    else warnings.push("preview-host: ignored an invalid FRAME_ANCESTORS entry");
  }
  if (origins.length === 0) warnings.push("preview-host: FRAME_ANCESTORS has no valid entries");
  return { origins, warnings };
}
