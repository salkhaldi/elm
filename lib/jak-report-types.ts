import type { JakReportFont } from "./jak-report-fonts.ts";

/** العقد المشترك لتقرير جاك HTML/CSS/JavaScript المستقل. */
export type JakCodeReportStatus = "draft" | "review" | "published" | "archived";

export interface JakCodeReport {
  id: string;
  /** رقم الرابط العام؛ قد يغيب فقط عن fixtures القديمة خارج قاعدة البيانات. */
  publicNumber: number;
  slug: string;
  title: string;
  excerpt: string;
  image: string | null;
  html: string;
  css: string;
  js: string;
  fonts: JakReportFont[];
  readingText: string;
  /** الظهور في فهرس جاك، وليس الصفحة الرئيسية الإخبارية العامة. */
  showOnHomepage: boolean;
  status: JakCodeReportStatus;
  authorId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  sourceUrl: string | null;
  sourcePostId: number | null;
  sourcePublishedAt: string | null;
  sourceModifiedAt: string | null;
}

export interface JakCodeReportInput {
  id: string;
  expectedVersion?: number;
  title: string;
  excerpt: string;
  image: string | null;
  html: string;
  css: string;
  js?: string;
  fonts?: JakReportFont[];
  readingText?: string;
  showOnHomepage: boolean;
}
