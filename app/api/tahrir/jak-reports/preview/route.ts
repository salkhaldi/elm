import { requirePermission } from "@/lib/tahrir/access";
import { buildJakDocument, jakDocumentHeaders } from "@/lib/jak-report-document";
import { validJakFonts } from "@/lib/jak-report-fonts";
import { isJakSameOrigin, readJakBody } from "@/lib/tahrir/jak-request";

export async function POST(request: Request) {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  // A form POST is allowed for iframe previews, but not cross-site submissions.
  if (!isJakSameOrigin(request)) {
    return new Response("طلب المعاينة غير مسموح.", { status: 403 });
  }
  let data: FormData;
  try {
    const bytes = await readJakBody(request, 16 * 1024 * 1024);
    data = await new Response(Buffer.from(bytes), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { return new Response("طلب المعاينة غير صالح أو تجاوز الحجم المسموح.", { status: 400 }); }
  const html = data?.get("html");
  const css = data?.get("css") ?? "";
  const title = data?.get("title") ?? "معاينة التقرير";
  const js = data.get("js") ?? "";
  let fonts: unknown;
  try { fonts = JSON.parse(String(data.get("fonts") ?? "[]")); } catch { fonts = null; }
  if (typeof js !== "string" || new TextEncoder().encode(js).byteLength > 1024 * 1024 || !validJakFonts(fonts)) return new Response("JavaScript أو الخطوط غير صالحة.", { status: 400 });
  if (typeof html !== "string" || typeof css !== "string" || typeof title !== "string" || !html.trim() || new TextEncoder().encode(html).byteLength > 2 * 1024 * 1024 || new TextEncoder().encode(css).byteLength > 1024 * 1024 || title.length > 500) {
    return new Response("أكواد المعاينة غير صالحة أو تجاوزت الحجم المسموح.", { status: 400 });
  }
  return new Response(buildJakDocument({ html, css, title, js, fonts }), { headers: jakDocumentHeaders() });
}
