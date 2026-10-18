"use client";

import { useId, useRef, useState } from "react";
import { JAK_SANDBOX } from "@/lib/jak-report-document";
import type { JakReportFont } from "@/lib/jak-report-fonts";

/** POST navigation gives the preview its own response CSP; srcDoc cannot do that. */
export function JakCodePreview({ html, css, title, js = "", fonts = [] }: { html: string; css: string; title: string; js?: string; fonts?: JakReportFont[] }) {
  const frameName = `jak-preview-${useId().replace(/:/g, "")}`;
  const form = useRef<HTMLFormElement>(null);
  const [mobile, setMobile] = useState(false);
  const [opened, setOpened] = useState(false);
  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-label="معاينة التقرير">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto font-semibold">معاينة التقرير</h2>
        <button type="button" className="rounded-md border px-3 py-2 text-sm" aria-pressed={!mobile} onClick={() => setMobile(false)}>كمبيوتر</button>
        <button type="button" className="rounded-md border px-3 py-2 text-sm" aria-pressed={mobile} onClick={() => setMobile(true)}>جوال</button>
        <button type="button" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" disabled={!html.trim()} onClick={() => { setOpened(true); form.current?.submit(); }}>تحديث المعاينة</button>
      </div>
      <p className="text-xs text-muted-foreground">تظهر الأكواد الحالية عند تحديث المعاينة. لا تُحفظ التعديلات إلا بزر الحفظ.</p>
      <form ref={form} method="post" action="/api/tahrir/jak-reports/preview" target={frameName} className="hidden">
        <input type="hidden" name="html" value={html} />
        <input type="hidden" name="css" value={css} />
        <input type="hidden" name="js" value={js} />
        <input type="hidden" name="fonts" value={JSON.stringify(fonts)} />
        <input type="hidden" name="title" value={title} />
      </form>
      {!opened && <p className="p-6 text-center text-sm text-muted-foreground">اضغط «تحديث المعاينة» لعرض التقرير.</p>}
      <iframe
        name={frameName}
        title={`معاينة ${title || "التقرير"}`}
        sandbox={JAK_SANDBOX}
        referrerPolicy="no-referrer"
        className="mx-auto rounded-lg border bg-white"
        style={{ width: mobile ? "min(390px, 100%)" : "100%", height: mobile ? 740 : 760, display: opened ? "block" : "none" }}
      />
    </section>
  );
}
