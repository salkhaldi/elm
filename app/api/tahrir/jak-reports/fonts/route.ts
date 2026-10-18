import { requirePermission } from "@/lib/tahrir/access";
import { isJakSameOrigin, readJakBody } from "@/lib/tahrir/jak-request";
import { detectFont, MAX_FONT_BYTES } from "@/lib/jak-report-fonts";
import { putJakFont } from "@/lib/storage/jak-fonts";

export async function POST(request: Request) {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  if (!isJakSameOrigin(request)) return Response.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  let form: FormData;
  try {
    const bytes = await readJakBody(request, MAX_FONT_BYTES + 64 * 1024);
    form = await new Response(Buffer.from(bytes), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { return Response.json({ error: "تعذر قراءة الملف؛ الحد الأقصى للخط 2MB." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "أرفق ملف الخط." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectFont(bytes);
  if (!kind) return Response.json({ error: "ارفع خطًا صالحًا بصيغة WOFF2 أو WOFF أو TTF أو OTF، بحجم لا يتجاوز 2MB." }, { status: 415 });
  const filename = `${crypto.randomUUID()}.${kind.extension}`;
  try { await putJakFont(filename, bytes, kind.contentType); }
  catch { console.error("[jak-fonts] upload failed"); return Response.json({ error: "تعذر حفظ الخط. أعد المحاولة." }, { status: 503 }); }
  return Response.json({ ok: true, filename }, { headers: { "Cache-Control": "private, no-store" } });
}
