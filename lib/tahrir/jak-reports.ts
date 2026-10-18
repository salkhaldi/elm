import { and, asc, eq, sql } from "drizzle-orm";

import { jakCodeReports } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { JakCodeReport, JakCodeReportInput, JakCodeReportStatus } from "@/lib/jak-report-types";
import type { WriteActor } from "./write-policy";
import { validJakFonts } from "../jak-report-fonts";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CSS_BYTES = 1024 * 1024;
const MAX_URL_LENGTH = 2_048;
const STATUS_VALUES = ["draft", "review", "published", "archived"] as const satisfies readonly JakCodeReportStatus[];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class JakReportError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type JakReportRow = typeof jakCodeReports.$inferSelect;

function requireDb() {
  const db = getDb();
  if (!db) throw new JakReportError("قاعدة البيانات غير مهيأة.", 503);
  return db;
}

function toReport(row: JakReportRow): JakCodeReport {
  return {
    id: row.id,
    publicNumber: row.publicNumber,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    image: row.image,
    html: row.html,
    css: row.css,
    js: row.js,
    fonts: row.fonts,
    readingText: row.readingText,
    showOnHomepage: row.showOnHomepage === 1,
    status: row.status as JakCodeReportStatus,
    authorId: row.authorId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    sourceUrl: row.sourceUrl,
    sourcePostId: row.sourcePostId,
    sourcePublishedAt: row.sourcePublishedAt,
    sourceModifiedAt: row.sourceModifiedAt,
  };
}

function bytes(value: string) { return new TextEncoder().encode(value).byteLength; }

function validateUrl(value: string | null, field: string) {
  if (value === null || value === "") return;
  if (value.length > MAX_URL_LENGTH) throw new JakReportError(`${field} يتجاوز الحد المسموح.`, 413);
  if (value.startsWith("/")) {
    if (value.startsWith("//")) throw new JakReportError(`${field} يجب أن يستخدم مسارًا محليًا صحيحًا.`, 400);
    return;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
  } catch {
    throw new JakReportError(`${field} يجب أن يكون رابط http(s) أو مسارًا محليًا.`, 400);
  }
}

function slugFor(title: string, id: string) {
  const slug = title.normalize("NFC").replace(/\p{M}+/gu, "").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 200);
  return slug || `jak-${id.slice(0, 8)}`;
}

function validateInput(input: JakCodeReportInput) {
  if (!input || typeof input !== "object") throw new JakReportError("مدخل التقرير غير صالح.", 400);
  if (typeof input.id !== "string" || !UUID_RE.test(input.id)) throw new JakReportError("معرّف التقرير يجب أن يكون UUID صالحًا.", 400);
  if (typeof input.title !== "string" || !input.title.trim()) throw new JakReportError("العنوان مطلوب.", 400);
  if (typeof input.excerpt !== "string" || typeof input.html !== "string" || typeof input.css !== "string") {
    throw new JakReportError("حقول التقرير النصية غير صالحة.", 400);
  }
  if (input.image !== null && typeof input.image !== "string") throw new JakReportError("الصورة غير صالحة.", 400);
  if (input.title.length > 500 || input.excerpt.length > 2_000) throw new JakReportError("العنوان أو الموجز يتجاوز الحد المسموح.", 413);
  if (bytes(input.html) > MAX_HTML_BYTES) throw new JakReportError("HTML يتجاوز حد 2MB.", 413);
  if (bytes(input.css) > MAX_CSS_BYTES) throw new JakReportError("CSS يتجاوز حد 1MB.", 413);
  if (input.js !== undefined && (typeof input.js !== "string" || bytes(input.js) > 1024 * 1024)) throw new JakReportError("JavaScript غير صالح أو يتجاوز 1MB.", 413);
  if (input.readingText !== undefined && (typeof input.readingText !== "string" || bytes(input.readingText) > 1024 * 1024)) throw new JakReportError("نص القراءة غير صالح أو يتجاوز 1MB.", 413);
  if (input.fonts !== undefined && !validJakFonts(input.fonts)) throw new JakReportError("بيانات الخطوط غير صالحة؛ الحد الأقصى 8 خطوط.", 400);
  if (typeof input.showOnHomepage !== "boolean") throw new JakReportError("قيمة إظهار التقرير غير صالحة.", 400);
  if (input.expectedVersion !== undefined && (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0)) {
    throw new JakReportError("نسخة التقرير غير صالحة.", 400);
  }
  validateUrl(input.image, "الصورة");
}

function assertManage(actor: WriteActor) {
  if (actor.mustChangePassword) throw new JakReportError("غيّر كلمة المرور المؤقتة أولًا.", 403);
  if (!actor.can("jak.manage")) throw new JakReportError("لا تملك صلاحية إدارة تقارير جاك.", 403);
}

function assertOwnOrAny(actor: WriteActor, report: JakReportRow | null) {
  if (!report) {
    if (!actor.can("story.create")) throw new JakReportError("ليست لديك صلاحية إنشاء تقرير.", 403);
    return;
  }
  if (actor.can("story.edit.any")) return;
  if (actor.can("story.edit.own") && report.authorId === actor.userId) return;
  throw new JakReportError("لا تملك صلاحية تحرير هذا التقرير.", 403);
}

function reportProjection(alias = "mutated") {
  const table = sql.raw(alias);
  return sql`${table}."id" as "id", ${table}."public_number" as "publicNumber", ${table}."slug" as "slug", ${table}."title" as "title", ${table}."excerpt" as "excerpt", ${table}."image" as "image", ${table}."html" as "html", ${table}."css" as "css", ${table}."js" as "js", ${table}."fonts" as "fonts", ${table}."reading_text" as "readingText", ${table}."show_on_homepage" as "showOnHomepage", ${table}."status" as "status", ${table}."author_id" as "authorId", ${table}."version" as "version", ${table}."created_at" as "createdAt", ${table}."updated_at" as "updatedAt", ${table}."published_at" as "publishedAt", ${table}."source_url" as "sourceUrl", ${table}."source_post_id" as "sourcePostId", ${table}."source_published_at" as "sourcePublishedAt", ${table}."source_modified_at" as "sourceModifiedAt"`;
}

async function mutationResult(db: ReturnType<typeof getDb>, query: ReturnType<typeof sql>): Promise<JakCodeReport> {
  if (!db) throw new JakReportError("قاعدة البيانات غير مهيأة.", 503);
  const result = await db.execute(query) as { rows?: JakReportRow[] };
  const row = result.rows?.[0];
  if (!row) throw new JakReportError("تغيّرت المادة أثناء العملية. أعد تحميل أحدث نسخة.", 409);
  return toReport(row);
}

export async function getJakReport(id: string, actor?: WriteActor): Promise<JakCodeReport | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select().from(jakCodeReports).where(eq(jakCodeReports.id, id)).limit(1);
  if (row && actor) {
    assertManage(actor);
    assertOwnOrAny(actor, row);
  }
  return row ? toReport(row) : null;
}

/** Only published imports may replace historical public story links. */
export async function getPublishedJakReportBySourceId(sourcePostId: number): Promise<JakCodeReport | null> {
  const db = getDb();
  if (!db || !Number.isSafeInteger(sourcePostId) || sourcePostId < 1) return null;
  const [row] = await db.select().from(jakCodeReports).where(and(
    eq(jakCodeReports.sourcePostId, sourcePostId),
    eq(jakCodeReports.status, "published"),
  )).limit(1);
  return row ? toReport(row) : null;
}

const MAX_PUBLIC_JAK_REPORT_NUMBER = 2_147_483_647;

/** القراءة العامة: UUID قديم أو رقم رابط عام موجب، للمواد المنشورة فقط. */
export async function getPublishedJakReportByPublicId(publicId: string): Promise<JakCodeReport | null> {
  const db = getDb();
  if (!db || typeof publicId !== "string") return null;
  const clean = publicId.trim();
  const isUuid = UUID_RE.test(clean);
  const isPublicNumber = /^[1-9][0-9]*$/u.test(clean);
  if (!isUuid && !isPublicNumber) return null;
  if (isPublicNumber) {
    const number = Number(clean);
    if (!Number.isSafeInteger(number) || number < 1 || number > MAX_PUBLIC_JAK_REPORT_NUMBER) return null;
    const [row] = await db.select().from(jakCodeReports).where(and(
      eq(jakCodeReports.publicNumber, number),
      eq(jakCodeReports.status, "published"),
    )).limit(1);
    return row ? toReport(row) : null;
  }
  const [row] = await db.select().from(jakCodeReports).where(and(
    eq(jakCodeReports.id, clean),
    eq(jakCodeReports.status, "published"),
  )).limit(1);
  return row ? toReport(row) : null;
}

export async function listJakReports(options: { publicOnly?: boolean; limit?: number; actor?: WriteActor } = {}): Promise<JakCodeReport[]> {
  const publicOnly = options.publicOnly === true;
  if (!publicOnly) {
    if (!options.actor) throw new JakReportError("قراءة تقارير جاك تتطلب جلسة تحرير.", 403);
    assertManage(options.actor);
  }
  const db = getDb();
  if (!db) {
    if (publicOnly) return [];
    throw new JakReportError("قاعدة البيانات غير مهيأة.", 503);
  }
  const requestedLimit = Number(options.limit ?? 50);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.trunc(requestedLimit))) : 50;
  if (!publicOnly && !options.actor?.can("story.edit.any") && !options.actor?.can("story.edit.own")) {
    throw new JakReportError("ليست لديك صلاحية قراءة تقاريرك.", 403);
  }
  const visibility = publicOnly
    ? eq(jakCodeReports.status, "published")
    : options.actor?.can("story.edit.any")
      ? undefined
      : eq(jakCodeReports.authorId, options.actor!.userId);
  const rows = await db.select().from(jakCodeReports)
    .where(visibility)
    .orderBy(sql`coalesce(${jakCodeReports.sourcePublishedAt}, ${jakCodeReports.publishedAt}, ${jakCodeReports.createdAt}) desc`, asc(jakCodeReports.id))
    .limit(limit);
  return rows.map(toReport);
}

export async function saveJakReport(input: JakCodeReportInput, actor: WriteActor): Promise<JakCodeReport> {
  validateInput(input);
  assertManage(actor);
  const db = requireDb();
  const [existing] = await db.select().from(jakCodeReports).where(eq(jakCodeReports.id, input.id)).limit(1);
  // Older open editors must not erase fields they do not yet send.
  const js = input.js ?? existing?.js ?? "";
  const fonts = input.fonts ?? existing?.fonts ?? [];
  const readingText = input.readingText ?? existing?.readingText ?? "";
  // إعادة إرسال إنشاء مسودة بمعرّف ثابت تعيد الصف نفسه إذا كان المحتوى مطابقًا؛
  // أي اختلاف يبقى تعارضًا ولا يستبدل مادة يملكها محرر آخر.
  if (existing && input.expectedVersion === 0) {
    const same = existing.status === "draft"
      && existing.title === input.title.trim()
      && existing.excerpt === input.excerpt
      && existing.image === input.image
      && existing.html === input.html
      && existing.css === input.css
      && existing.js === js
      && JSON.stringify(existing.fonts) === JSON.stringify(fonts)
      && existing.readingText === readingText
      && existing.showOnHomepage === (input.showOnHomepage ? 1 : 0);
    if (same) {
      assertOwnOrAny(actor, existing);
      return toReport(existing);
    }
    throw new JakReportError("معرّف التقرير مستخدم لمحتوى مختلف.", 409);
  }
  assertOwnOrAny(actor, existing ?? null);
  if (existing && input.expectedVersion === undefined) throw new JakReportError("نسخة التقرير مطلوبة للحفظ.", 409);
  if (existing && existing.status === "archived") throw new JakReportError("استعد التقرير المؤرشف عبر انتقال معتمد قبل تحريره.", 409);
  if (existing?.status === "published" && !actor.can("jak.publish")) {
    throw new JakReportError("تعديل التقرير المنشور يتطلب صلاحية النشر؛ أعده لمسودة أولًا عبر انتقال معتمد.", 403);
  }
  if (existing && input.expectedVersion !== existing.version) throw new JakReportError("تغيّرت المادة منذ فتحها. أعد تحميلها قبل الحفظ.", 409);

  const now = new Date().toISOString();
  const values = {
    slug: existing?.slug ?? slugFor(input.title, input.id),
    title: input.title.trim(),
    excerpt: input.excerpt,
    image: input.image,
    html: input.html,
    css: input.css,
    js,
    fonts,
    readingText,
    showOnHomepage: input.showOnHomepage ? 1 : 0,
    updatedAt: now,
  };
  if (!existing) {
    const context = JSON.stringify({ reportId: input.id, version: 1, action: "jak:report-create" });
    return mutationResult(db, sql`with inserted as (
      insert into "jak_code_reports" ("id", "slug", "title", "excerpt", "image", "html", "css", "js", "fonts", "reading_text", "show_on_homepage", "status", "author_id", "version", "created_at", "updated_at", "published_at", "source_url", "source_post_id", "source_published_at", "source_modified_at")
      values (${input.id}, ${values.slug}, ${values.title}, ${values.excerpt}, ${values.image}, ${values.html}, ${values.css}, ${values.js}, ${JSON.stringify(values.fonts)}::jsonb, ${values.readingText}, ${values.showOnHomepage}, 'draft', ${actor.userId}, 1, ${now}, ${now}, null, null, null, null, null)
      returning *
    ), logged as (
      insert into "audit_log" ("id", "at", "actor", "action", "story_id", "detail", "context")
      select ${crypto.randomUUID()}, ${now}, ${actor.username}, 'jak:report-create', ${input.id}, 'إنشاء مسودة تقرير جاك', ${context}::jsonb from inserted
      returning "id"
    )
    select ${reportProjection("inserted")} from inserted cross join logged`);
  }

  const nextVersion = existing.version + 1;
  const context = JSON.stringify({ reportId: input.id, version: nextVersion, action: "jak:report-save" });
  return mutationResult(db, sql`with updated as (
    update "jak_code_reports"
    set "slug" = ${values.slug}, "title" = ${values.title}, "excerpt" = ${values.excerpt}, "image" = ${values.image}, "html" = ${values.html}, "css" = ${values.css}, "js" = ${values.js}, "fonts" = ${JSON.stringify(values.fonts)}::jsonb, "reading_text" = ${values.readingText}, "show_on_homepage" = ${values.showOnHomepage}, "updated_at" = ${now}, "version" = ${nextVersion}
    where "id" = ${input.id} and "version" = ${existing.version}
    returning *
  ), logged as (
    insert into "audit_log" ("id", "at", "actor", "action", "story_id", "detail", "context")
    select ${crypto.randomUUID()}, ${now}, ${actor.username}, 'jak:report-save', ${input.id}, 'حفظ تقرير جاك', ${context}::jsonb from updated
    returning "id"
  )
  select ${reportProjection("updated")} from updated cross join logged`);
}

export async function transitionJakReport(
  id: string,
  status: JakCodeReportStatus,
  expectedVersion: number,
  actor: WriteActor,
): Promise<JakCodeReport> {
  assertManage(actor);
  if (!STATUS_VALUES.includes(status)) throw new JakReportError("حالة التقرير غير صالحة.", 400);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new JakReportError("نسخة التقرير غير صالحة.", 400);
  const db = requireDb();
  const [existing] = await db.select().from(jakCodeReports).where(eq(jakCodeReports.id, id)).limit(1);
  if (!existing) throw new JakReportError("التقرير غير موجود.", 404);
  if (existing.version !== expectedVersion) throw new JakReportError("تغيّرت المادة منذ فتحها. أعد تحميلها قبل الانتقال.", 409);
  if (existing.status === status) {
    if (status === "published" && !actor.can("jak.publish")) throw new JakReportError("النشر من صلاحية المعتمدين فقط.", 403);
    if (status === "archived" && !actor.can("jak.archive")) throw new JakReportError("أرشفة التقرير من صلاحية المعتمدين.", 403);
    if (status === "review" && !actor.can("story.submit")) throw new JakReportError("رفع التقرير للمراجعة من صلاحية المحررين.", 403);
    if (status === "draft") assertOwnOrAny(actor, existing);
    if (status === "review") assertOwnOrAny(actor, existing);
    return toReport(existing);
  }

  if (existing.status === "archived" && status !== "draft") {
    throw new JakReportError("استعد التقرير المؤرشف إلى مسودة قبل أي انتقال آخر.", 409);
  }

  const isPublish = status === "published";
  const isSubmit = status === "review";
  const isArchive = status === "archived";
  const isReturnToDraft = status === "draft" && existing.status === "published";
  if (isPublish && !actor.can("jak.publish")) throw new JakReportError("النشر من صلاحية المعتمدين فقط.", 403);
  if (isSubmit && !actor.can("story.submit")) throw new JakReportError("رفع التقرير للمراجعة من صلاحية المحررين.", 403);
  if (isArchive && !actor.can("jak.archive")) throw new JakReportError("أرشفة التقرير من صلاحية المعتمدين.", 403);
  if (isReturnToDraft && !actor.can("jak.publish")) throw new JakReportError("إعادة المنشور لمسودة تتطلب صلاحية النشر.", 403);
  if (isSubmit || (status === "draft" && existing.status === "review")) assertOwnOrAny(actor, existing);
  if (status === "draft" && existing.status === "archived" && !actor.can("jak.restore")) {
    throw new JakReportError("استعادة التقرير المؤرشف تتطلب صلاحية الاستعادة.", 403);
  }
  if (status === "review" && existing.status === "published") {
    throw new JakReportError("أعد التقرير المنشور لمسودة قبل إرساله للمراجعة.", 409);
  }
  if (status === "draft" && !isReturnToDraft && existing.status !== "review" && existing.status !== "archived") {
    throw new JakReportError("الانتقال إلى المسودة غير متاح من هذه الحالة.", 409);
  }

  const now = new Date().toISOString();
  const nextVersion = existing.version + 1;
  if (status === "published" && !existing.html.trim()) throw new JakReportError("لا يمكن نشر تقرير بلا HTML.", 422);
  const action = isPublish ? "jak:report-publish" : isArchive ? "jak:report-archive" : isSubmit ? "jak:report-submit" : "jak:report-draft";
  const context = JSON.stringify({ reportId: id, version: nextVersion, action });
  return mutationResult(db, sql`with updated as (
    update "jak_code_reports"
    set "status" = ${status}, "version" = ${nextVersion}, "updated_at" = ${now}, "published_at" = ${isPublish ? now : existing.publishedAt}
    where "id" = ${id} and "version" = ${expectedVersion}
    returning *
  ), logged as (
    insert into "audit_log" ("id", "at", "actor", "action", "story_id", "detail", "context")
    select ${crypto.randomUUID()}, ${now}, ${actor.username}, ${action}, ${id}, ${`تغيير حالة تقرير جاك إلى ${status}`}, ${context}::jsonb from updated
    returning "id"
  )
  select ${reportProjection("updated")} from updated cross join logged`);
}

/** Delete the row and write its audit event in the same statement. Stored shared
 * fonts/media are retained: removing one report must not break another report.
 */
export async function deleteJakReport(id: string, expectedVersion: number, confirmationTitle: string, actor: WriteActor) {
  assertManage(actor);
  if (!actor.can("jak.delete")) throw new JakReportError("لا تملك صلاحية الحذف النهائي لتقارير جاك.", 403);
  if (!UUID_RE.test(id) || !Number.isInteger(expectedVersion) || expectedVersion < 1) throw new JakReportError("معرّف التقرير ونسخته مطلوبان.", 400);
  const db = requireDb();
  const [existing] = await db.select().from(jakCodeReports).where(eq(jakCodeReports.id, id)).limit(1);
  if (!existing) throw new JakReportError("التقرير غير موجود.", 404);
  assertOwnOrAny(actor, existing);
  if (existing.status !== "archived") throw new JakReportError("أرشف التقرير أولًا قبل الحذف النهائي.", 409);
  if (existing.version !== expectedVersion) throw new JakReportError("تغيّر التقرير. أعد تحميله قبل الحذف.", 409);
  if (confirmationTitle !== existing.title) throw new JakReportError("اكتب عنوان التقرير مطابقًا لتأكيد الحذف النهائي.", 400);
  const now = new Date().toISOString();
  const context = JSON.stringify({ reportId: id, publicNumber: existing.publicNumber, version: expectedVersion });
  const result = await db.execute(sql`with deleted as (
    delete from "jak_code_reports" where "id" = ${id} and "version" = ${expectedVersion} and "status" = 'archived' returning "id"
  ), logged as (
    insert into "audit_log" ("id", "at", "actor", "action", "story_id", "detail", "context")
    select ${crypto.randomUUID()}, ${now}, ${actor.username}, 'jak:report-delete', "id", ${`حذف تقرير جاك نهائيًا: ${existing.title}`}, ${context}::jsonb from deleted returning "id"
  ) select deleted."id" from deleted cross join logged`) as { rows?: { id: string }[] };
  if (!result.rows?.length) throw new JakReportError("تغيّر التقرير أثناء الحذف. أعد تحميله.", 409);
  return { id };
}

export function validateJakReportInput(value: unknown): JakCodeReportInput {
  const input = value as Partial<JakCodeReportInput> | null;
  if (!input || typeof input !== "object") throw new JakReportError("مدخل التقرير غير صالح.", 400);
  return {
    id: input.id as string,
    expectedVersion: input.expectedVersion,
    title: input.title as string,
    excerpt: input.excerpt as string,
    image: input.image as string | null,
    html: input.html as string,
    css: input.css as string,
    js: input.js,
    fonts: input.fonts,
    readingText: input.readingText,
    showOnHomepage: input.showOnHomepage as boolean,
  };
}
