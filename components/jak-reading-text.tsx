import { jakReadingText } from "@/lib/jak-reading-text";

export function JakReadingText({ report }: { report: { title: string; html?: string; readingText?: string } }) {
  const text = jakReadingText(report);
  if (!text) return null;
  return <details className="jak-reading-text" id="jak-reading-text">
    <summary>قراءة نص التقرير</summary>
    <article>
      <h2>{report.title}</h2>
      {text.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </article>
  </details>;
}
