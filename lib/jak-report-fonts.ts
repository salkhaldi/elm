export interface JakReportFont {
  family: string;
  filename: string;
  weight: string;
  style: "normal" | "italic";
}

export const MAX_FONT_BYTES = 2 * 1024 * 1024;
export const FONT_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:woff2?|ttf|otf)$/i;
const FAMILY = /^[\p{L}\p{N} _-]{1,80}$/u;

export function validJakFonts(value: unknown): value is JakReportFont[] {
  if (!Array.isArray(value) || value.length > 8) return false;
  const faces = new Set<string>();
  return value.every((font) => {
    if (!font || typeof font !== "object" || typeof font.family !== "string" || !FAMILY.test(font.family.trim())
      || typeof font.filename !== "string" || !FONT_FILENAME.test(font.filename)
      || typeof font.weight !== "string" || !/^[1-9]00(?: [1-9]00)?$/.test(font.weight)
      || !["normal", "italic"].includes(font.style)) return false;
    const weights = font.weight.split(" ").map(Number);
    if (weights.length === 2 && weights[0] > weights[1]) return false;
    const face = `${font.family.trim().toLowerCase()}:${font.weight}:${font.style}`;
    if (faces.has(face)) return false;
    faces.add(face);
    return true;
  });
}

/** Reject unrelated uploads using container headers and bounded table directories.
 * Browsers still validate the full font before rendering it. No server font parser runs.
 */
export function detectFont(bytes: Uint8Array): { extension: string; contentType: string } | null {
  if (bytes.length < 12 || bytes.length > MAX_FONT_BYTES) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = view.getUint32(0);
  if (signature === 0x774f4646 || signature === 0x774f4632) {
    const woff2 = signature === 0x774f4632;
    const header = woff2 ? 48 : 44;
    if (bytes.length < header || view.getUint32(8) !== bytes.length || view.getUint16(14) !== 0
      || view.getUint16(12) < 1 || view.getUint16(12) > 256 || view.getUint32(16) > 16 * 1024 * 1024) return null;
    if (!woff2) {
      const count = view.getUint16(12);
      if (header + count * 20 > bytes.length) return null;
      for (let i = 0; i < count; i++) {
        const offset = view.getUint32(header + i * 20 + 4);
        const size = view.getUint32(header + i * 20 + 8);
        if (offset < header + count * 20 || offset + size > bytes.length) return null;
      }
    } else if (view.getUint32(20) > bytes.length - header) return null;
    return { extension: woff2 ? "woff2" : "woff", contentType: woff2 ? "font/woff2" : "font/woff" };
  }
  if (signature !== 0x00010000 && signature !== 0x4f54544f) return null;
  const count = view.getUint16(4);
  if (count < 1 || count > 256 || 12 + count * 16 > bytes.length) return null;
  for (let i = 0; i < count; i++) {
    const offset = view.getUint32(12 + i * 16 + 8);
    const size = view.getUint32(12 + i * 16 + 12);
    if (offset < 12 + count * 16 || offset + size > bytes.length) return null;
  }
  return { extension: signature === 0x4f54544f ? "otf" : "ttf", contentType: signature === 0x4f54544f ? "font/otf" : "font/ttf" };
}

export function jakFontCss(fonts: JakReportFont[] = []) {
  if (!validJakFonts(fonts)) return "";
  return fonts.map(font => `@font-face{font-family:"${font.family.trim()}";src:url("/jak-fonts/${font.filename}");font-weight:${font.weight};font-style:${font.style};font-display:swap;}`).join("\n");
}
