import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/tahrir/access";
import {
  getJakReport,
  deleteJakReport,
  JakReportError,
  listJakReports,
  saveJakReport,
  transitionJakReport,
  validateJakReportInput,
} from "@/lib/tahrir/jak-reports";
import type { JakCodeReportStatus } from "@/lib/jak-report-types";
import { isJakSameOrigin, readJakBody } from "@/lib/tahrir/jak-request";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof JakReportError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

/** القراءة الخاصة بلوحة جاك؛ القراءة العامة تستخدم publicOnly داخل الخدمة بعد بوابة الصفحة العامة. */
export async function GET(request: Request) {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  const params = new URL(request.url).searchParams;
  const id = params.get("id")?.trim();
  try {
    if (id) {
      const report = await getJakReport(id, gate.actor);
      if (!report) return NextResponse.json({ error: "التقرير غير موجود." }, { status: 404 });
      return NextResponse.json({ ok: true, report }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const reports = await listJakReports({
      actor: gate.actor,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
      publicOnly: false,
    });
    return NextResponse.json({ ok: true, reports }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const gate = await requirePermission("jak.manage");
  if (!gate.ok) return gate.response;
  if (!isJakSameOrigin(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  }
  let body: Record<string, unknown> | null;
  try { body = JSON.parse(new TextDecoder().decode(await readJakBody(request, 8 * 1024 * 1024))); }
  catch { return NextResponse.json({ error: "الطلب غير صالح أو تجاوز الحجم المسموح." }, { status: 400 }); }
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "الإجراء مطلوب." }, { status: 400 });
  try {
    if (body.action === "delete") {
      if (typeof body.id !== "string" || typeof body.confirmationTitle !== "string" || !Number.isInteger(body.expectedVersion)) {
        return NextResponse.json({ error: "معرّف التقرير ونسخته وعنوان التأكيد مطلوبة." }, { status: 400 });
      }
      const deleted = await deleteJakReport(body.id, body.expectedVersion as number, body.confirmationTitle, gate.actor);
      return NextResponse.json({ ok: true, deleted }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "save") {
      const report = await saveJakReport(validateJakReportInput(body), gate.actor);
      return NextResponse.json({ ok: true, report });
    }
    if (body.action === "transition") {
      if (typeof body.id !== "string" || typeof body.status !== "string" || !Number.isInteger(body.expectedVersion)) {
        return NextResponse.json({ error: "معرّف التقرير والحالة والنسخة مطلوبة." }, { status: 400 });
      }
      const report = await transitionJakReport(
        body.id,
        body.status as JakCodeReportStatus,
        body.expectedVersion as number,
        gate.actor,
      );
      return NextResponse.json({ ok: true, report });
    }
    return NextResponse.json({ error: "إجراء غير معروف." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
