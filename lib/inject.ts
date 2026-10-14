import { BRIDGE_JS } from "./bridge";

const TAG = `<script>${BRIDGE_JS}</script>`;

export function injectBridge(html: string): string {
  if (html.includes(BRIDGE_JS)) return html;
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + TAG;
  return html.slice(0, idx) + TAG + html.slice(idx);
}
