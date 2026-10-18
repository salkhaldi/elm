import { JakReportEditor } from "@/components/tahrir/jak-reports/jak-report-editor";
import { Forbidden } from "@/components/tahrir/forbidden";
import { requireScreen } from "@/lib/tahrir/screen";
import { listRecentMedia } from "@/lib/tahrir/service";

export const metadata = { title: "تقرير جاك جديد" };
export const dynamic = "force-dynamic";

export default async function NewJakReportPage() {
  const gate = await requireScreen("jak.manage", "جاك العلم");
  if (!gate.ok) return gate.element;
  if (!gate.actor.can("story.create")) {
    return <Forbidden title="تقرير جاك جديد" permission="story.create" message="لا تملك صلاحية إنشاء تقرير جاك جديد." />;
  }
  const mediaRows = await listRecentMedia({ rightsCleared: true, limit: 12 }).catch(() => []);
  return (
    <main>
      <JakReportEditor
        initial={null}
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
