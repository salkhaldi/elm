import { parse, type DefaultTreeAdapterMap } from "parse5";

const OMIT = new Set(["head", "script", "style", "template", "noscript", "svg", "canvas", "iframe", "object", "form", "button", "nav"]);
const BLOCK = new Set(["p", "div", "section", "article", "main", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "figcaption", "tr", "br"]);

/** Text only, never executable HTML. Parse without executing scripts or fetching
 * assets; iterative traversal also handles deeply nested imported documents.
 */
export function jakReadingText({ html = "", readingText = "" }: { html?: string; readingText?: string }) {
  if (readingText.trim()) return readingText.trim();
  const stack: (DefaultTreeAdapterMap["node"] | string)[] = [parse(html)];
  const output: string[] = [];
  while (stack.length) {
    const node = stack.pop()!;
    if (typeof node === "string") { output.push(node); continue; }
    if (node.nodeName === "#text" && "value" in node) { output.push(node.value.replace(/\s+/gu, " ")); continue; }
    if ("tagName" in node) {
      const attrs = new Map(node.attrs.map(attr => [attr.name, attr.value]));
      if (OMIT.has(node.tagName) || attrs.has("hidden") || attrs.get("aria-hidden") === "true"
        || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important)?\s*(?:;|$)/i.test(attrs.get("style") ?? "")) continue;
      if (BLOCK.has(node.tagName)) { output.push("\n\n"); stack.push("\n\n"); }
    }
    if ("childNodes" in node) for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
  }
  return output.join("").split(/\n+/).map(line => line.trim()).filter(Boolean).join("\n\n");
}
