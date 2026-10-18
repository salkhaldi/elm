import { FONT_FILENAME } from "@/lib/jak-report-fonts";
import { getJakFont } from "@/lib/storage/jak-fonts";
import { isMissingStoredImage } from "@/lib/storage/images";

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!FONT_FILENAME.test(filename)) return new Response(null, { status: 404 });
  try {
    const bytes = await getJakFont(filename);
    return new Response(Buffer.from(bytes), { headers: {
      "Content-Type": `font/${filename.split(".").at(-1)}`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    } });
  } catch (error) {
    return new Response(null, { status: isMissingStoredImage(error) ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
