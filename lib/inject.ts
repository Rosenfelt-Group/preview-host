import { BRIDGE_JS } from "./bridge";

const TAG = `<script>${BRIDGE_JS}</script>`;

export function injectBridge(html: string): string {
  if (html.includes(BRIDGE_JS)) return html;
  // Match on the original string: indexes into a lowercased copy can drift.
  let idx = -1;
  for (const m of html.matchAll(/<\/body\s*>/gi)) idx = m.index;
  if (idx === -1) return html + TAG;
  return html.slice(0, idx) + TAG + html.slice(idx);
}
