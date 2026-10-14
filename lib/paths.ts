// Segments come from the URL router, already decoded once. Anything that could
// leave the version's prefix is rejected outright.
export function safePath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  for (const s of segments) {
    if (s === "" || s.startsWith(".")) return null; // also covers "." and ".."; never serve dotfiles
    if (/[\\\0/%]/.test(s)) return null;
  }
  return segments.join("/");
}
