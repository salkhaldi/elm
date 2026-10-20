import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { getPublishedJakReportByPublicId } from "@/lib/tahrir/jak-reports";
import { JakCodeFrame } from "@/components/jak-code-frame";
import { jakReportMetadata } from "@/lib/jak-sharing";
import { jakReportHref, publicJakReportId } from "@/lib/jak-urls";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const report = await getPublishedJakReportByPublicId((await params).id);
  if (!report) return { title: "التقرير غير موجود", robots: { index: false, follow: false } };
  return jakReportMetadata(report);
}

export default async function JakReportPage({ params }: Props) {
  const { id, slug } = await params;
  const report = await getPublishedJakReportByPublicId(id);
  if (!report) notFound();
  // Next may pass URL-encoded Arabic parameters; compare their decoded value
  // before redirecting, otherwise the canonical URL redirects to itself.
  let decodedSlug = slug;
  try { decodedSlug = decodeURIComponent(slug); } catch { /* Redirect malformed aliases to the canonical path. */ }
  if (decodedSlug !== report.slug || id !== publicJakReportId(report)) permanentRedirect(jakReportHref(report));
  return (
    <main id="main-content" className="jak-reader-shell">
      <a className="skip-link" href="#jak-report-frame">انتقل إلى التقرير</a>
      <nav className="jak-reader-nav" aria-label="التنقل في التقرير">
        <Link className="jak-reader-back" href="/jak">
          <span aria-hidden="true">←</span>
          <span>جاك العلم</span>
        </Link>
      </nav>
      <h1 className="sr-only">{report.title}</h1>
      <JakCodeFrame id={report.id} title={report.title} />
    </main>
  );
}
