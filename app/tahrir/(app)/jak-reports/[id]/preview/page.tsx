import Link from "next/link";
import { notFound } from "next/navigation";
import { requireScreen } from "@/lib/tahrir/screen";
import { assertCanWrite } from "@/lib/tahrir/write-policy";
import { getJakReport } from "@/lib/tahrir/jak-reports";
import { JakCodeFrame } from "@/components/jak-code-frame";

export const dynamic = "force-dynamic";
export const metadata = { title: "معاينة تقرير جاك العلم", robots: { index: false, follow: false } };
export default async function JakReportPreview({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireScreen("jak.manage", "معاينة التقرير");
  if (!gate.ok) return gate.element;
  const report = await getJakReport((await params).id);
  if (!report) notFound();
  try { assertCanWrite(gate.actor, report); } catch { notFound(); }
  return <main className="grid gap-3">
    <nav className="flex flex-wrap gap-4 text-sm"><Link href="/tahrir/jak-reports/preview">← معاينة القسم</Link><Link href={`/tahrir/jak-reports/${report.id}`}>تحرير التقرير</Link></nav>
    <h1 className="text-xl font-bold">{report.title}</h1>
    <p className="text-sm text-muted-foreground">معاينة خاصة للنسخة المحفوظة · {report.status === "published" ? "منشور" : "غير منشور"}</p>
    <JakCodeFrame id={report.id} title={report.title} />
  </main>;
}
