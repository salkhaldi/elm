import { notFound } from "next/navigation";

import { Forbidden } from "@/components/tahrir/forbidden";
import { JakReportEditor } from "@/components/tahrir/jak-reports/jak-report-editor";
import { canEditStory } from "@/lib/tahrir/access";
import { getJakReport } from "@/lib/tahrir/jak-reports";
import { listRecentMedia } from "@/lib/tahrir/service";
import { requireScreen } from "@/lib/tahrir/screen";

export const metadata = { title: "تحرير تقرير جاك" };
export const dynamic = "force-dynamic";

export default async function JakReportEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireScreen("jak.manage", "جاك العلم");
  if (!gate.ok) return gate.element;
  const report = await getJakReport(id).catch(() => null);
  if (!report) notFound();
  if (!canEditStory(gate.actor, report)) {
    return <Forbidden title="تحرير تقرير جاك" permission="story.edit.own" message="لا تملك صلاحية تعديل هذا التقرير." />;
  }
  const mediaRows = await listRecentMedia({ rightsCleared: true, limit: 12 }).catch(() => []);
  return (
    <main>
      <JakReportEditor
        initial={report}
        actorId={gate.actor.userId}
        recentMedia={mediaRows.map((row) => ({ url: row.url, filename: row.filename }))}
        canSubmit={gate.actor.can("story.submit")}
        canPublish={gate.actor.can("jak.publish")}
        canArchive={gate.actor.can("jak.archive")}
        canRestore={gate.actor.can("jak.restore")}
        canDelete={gate.actor.can("jak.delete")}
      />
    </main>
  );
}
