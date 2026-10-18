import { imageVariantUrl } from "./image-source.ts";
import { jakFontCss, type JakReportFont } from "./jak-report-fonts.ts";
import { parse } from "parse5";

/** Raw report code is executable only inside an opaque-origin sandbox document.
 * Never inject it into an application page or use srcDoc (it inherits the app CSP).
 */
export const JAK_SANDBOX = "allow-scripts allow-popups allow-popups-to-escape-sandbox";

export function jakDocumentHeaders() {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": [
      `sandbox ${JAK_SANDBOX}`,
      "default-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "connect-src 'none'",
      "script-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/",
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com https://jakelelm.alelm.net",
      "img-src 'self' data: https://jakelelm.alelm.net https://dash.alelm.net https://alelm.net",
      "media-src 'self' https://jakelelm.alelm.net https://dash.alelm.net https://alelm.net",
    ].join("; "),
  };
}

const escapeText = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function isMobileJakReader(userAgent: string) {
  return /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent);
}

/** FIFA's 37 full-resolution image layers can overload mobile WebKit. Keep the
 * stored artwork intact, bound decoded image sizes and skip optional GSAP on
 * phones. Its rescale script remains essential to the 1920px artboard layout. */
function mobileFifaSource(html: string) {
  let imageIndex = 0;
  return html
    .replace(/<script\b[^>]*\bsrc=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/3\.12\.5\/[^"']+["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const source = /\bsrc=["']([^"']+)["']/i.exec(tag);
      if (!source) return tag;
      const optimized = imageVariantUrl(source[1], 1080, 78);
      if (optimized === source[1]) return tag;
      const loading = imageIndex++ < 2 ? "eager" : "lazy";
      return tag.replace(source[0], `src="${escapeText(optimized)}"`)
        .replace(/\s+(?:loading|decoding|srcset|sizes)\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\s*\/?>$/, ` loading="${loading}" decoding="async">`);
    });
}

/** Keep stored source untouched. Combine separate CSS, JS and fonts at rendering. */
export function buildJakDocument({ html, css, title, sourcePostId, js = "", fonts = [] }: { html: string; css: string; title: string; sourcePostId?: number | null; js?: string; fonts?: JakReportFont[] }, options: { mobile?: boolean } = {}): string {
  const renderedHtml = options.mobile && sourcePostId === 1956 ? mobileFifaSource(html) : html;
  // The original FIFA source includes a placeholder style.css link although its
  // actual stylesheet is stored in the separate field. Do not request our API URL.
  const source = css.trim()
    ? renderedHtml.replace(/<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])(?=[^>]*\bhref\s*=\s*["'](?:\.\/)?style\.css["'])[^>]*>/gi, "")
    : renderedHtml;
  const fontCss = jakFontCss(fonts);
  const style = (fontCss || css.trim()) ? `<style>${fontCss}\n${css.replace(/<\/style/gi, "<\\/style")}</style>` : "";
  const script = js.trim() ? `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>` : "";
  const fallback = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeText(title)}</title>`;
  // Appended CSS respects a standalone document's own fonts, styles and scripts.
  if (/<head\b[^>]*>/i.test(source)) {
    const document = source.replace(/<head\b[^>]*>/i, (head) => `${head}${fallback}${style}`);
    if (!script) return document;
    // A literal </body> in an existing script/comment is not the closing tag.
    const tree = parse(document, { sourceCodeLocationInfo: true });
    const root = tree.childNodes.find(node => node.nodeName === "html");
    const body = root && "childNodes" in root ? root.childNodes.find(node => node.nodeName === "body") : undefined;
    const location = body && "tagName" in body ? body.sourceCodeLocation : undefined;
    const offset = location?.endTag?.startOffset ?? document.length;
    return document.slice(0, offset) + script + document.slice(offset);
  }
  return `<!doctype html><html lang="ar" dir="rtl"><head>${fallback}${style}</head><body>${source}${script}</body></html>`;
}
