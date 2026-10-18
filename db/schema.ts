/**
 * مخطط محتوى العلم — نواة M4-T1: السلاسل والمواد ككيانات أصلية.
 * يُدفع إلى Neon عبر `npm run db:push`، ويُزرع من البذرة عبر `npm run db:seed`.
 */

import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { JakReportFont } from "../lib/jak-report-fonts";

export const series = pgTable("series", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  color: text("color").notNull(),
  /** سلسلة مخفية من فهارس الاستكشاف (المتقاعدة) — صفحتها تبقى حية. */
  hidden: integer("hidden").notNull().default(0),
});

export const stories = pgTable("stories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  eyebrow: text("eyebrow").notNull().default(""),
  readingMinutes: integer("reading_minutes").notNull().default(3),
  seriesSlug: text("series_slug"),
  image: text("image"),
  /** نقطة تركيز الصورة "س% ص%" لـobject-position — null = المنتصف. تُمسح عند تغيير الصورة. */
  imageFocus: text("image_focus"),
  /** ISO 8601 كما في مصدر ووردبريس — يُحوَّل لكائن تاريخ عند العرض فقط. */
  publishedAt: text("published_at"),
  /** نبض تحريري: يرفع المادة في ترتيب الرئيسية والقسم والسلسلة دون تغيير تاريخ النشر. */
  boostedAt: text("boosted_at"),
  /** بلوك الشائعة/الحقيقة لقالب «افهمها صح»: { rumor, truth }. */
  factCheck: jsonb("fact_check"),
  /** سير عمل «تحرير العلم»: draft → review → scheduled → published → archived. البذرة القديمة كلها published. */
  status: text("status").notNull().default("published"),
  body: text("body").notNull().default(""),
  authorName: text("author_name").notNull().default(""),
  authorId: text("author_id"),
  assignedTo: text("assigned_to"),
  dueAt: text("due_at"),
  returnedAt: text("returned_at"),
  version: integer("version").notNull().default(1),
  /** مسودة تعديل مستقلة؛ لا تُعرض للجمهور ولا تغيّر هوية الأصل. */
  revisionOf: text("revision_of"),
  baseVersion: integer("base_version"),
  updatedAt: text("updated_at"),
  /** موعد النشر المجدول (ISO) — تُرقّى المادة آليًا بعد مرورها على الحارس لحظة الموعد. */
  scheduledAt: text("scheduled_at"),
  /** شكل المادة: news | infographic | video | report | podcast — منفصل عن القسم الموضوعي. */
  format: text("format").notNull().default("news"),
  /** مثبتة في صدارة الرئيسية (قرار معتمد). */
  pinned: integer("pinned").notNull().default(0),
  /** عاجل حتى (ISO) — يظهر شريط العاجل ما دام المستقبل، ويختفي وحده. */
  breakingUntil: text("breaking_until"),
  /** عنوان SEO (يسقط للعنوان عند غيابه) — يتولد بالذكاء ويحرره البشر. */
  seoTitle: text("seo_title"),
  /** وصف SEO (يسقط للموجز عند غيابه). */
  seoDescription: text("seo_description"),
  /** كلمات مفتاحية: مصفوفة نصوص jsonb — تتولد بالذكاء وتُحرر يدويًا. */
  keywords: jsonb("keywords"),
  /** نفس تطبيع البحث العام؛ PostgreSQL يحدّثه تلقائيًا لكل حفظ واستيراد. */
  searchText: text("search_text").generatedAlwaysAs(sql`alelm_editor_search_normalize("title" || ' ' || "excerpt" || ' ' || "eyebrow" || ' ' || coalesce("keywords"::text, ''))`),
  /** نص بحث المحرر محسوب عند الحفظ، حتى لا يُعاد تطبيع المتون أثناء كل بحث قصير. */
  editorSearchText: text("editor_search_text").generatedAlwaysAs(sql`alelm_editor_search_normalize("title" || ' ' || "excerpt" || ' ' || coalesce("keywords"::text, '') || ' ' || "body")`),
  /** رابط يوتيوب لمواد شكل «فيديو» (رابط المشاهدة القياسي بلا قائمة تشغيل) — يُسحب من alelm-api ويُحرر من اللوحة. */
  videoUrl: text("video_url"),
  /** رقم الرابط العام القصير لمواد اللوحة (معرّفها UUID)؛ مواد ووردبريس رقمها هو معرّفها فيبقى null. */
  publicNumber: integer("public_number"),
}, (table) => [
  uniqueIndex("stories_public_number_uidx").on(table.publicNumber),
  index("stories_assigned_to_idx").on(table.assignedTo, table.status),
  index("stories_author_status_idx").on(table.authorId, table.status),
  index("stories_status_idx").on(table.status),
  index("stories_published_at_idx").on(table.publishedAt),
  index("stories_section_idx").on(table.section),
  index("stories_editor_search_trgm_idx").using("gin", table.editorSearchText.op("gin_trgm_ops")),
  index("stories_title_trgm_idx").using("gin", table.title.op("gin_trgm_ops")),
  index("stories_search_text_trgm_idx").using("gin", table.searchText.op("gin_trgm_ops")).where(sql`${table.status} = 'published'`),
  index("stories_active_recency_idx").on(sql`coalesce(${table.updatedAt}, ${table.publishedAt}) desc`, table.id.desc().nullsFirst()).where(sql`${table.status} <> 'archived'`),
  index("stories_status_recency_idx").on(table.status, sql`coalesce(${table.updatedAt}, ${table.publishedAt}) desc`, table.id.desc().nullsFirst()),
  index("stories_format_recency_idx").on(table.format, sql`coalesce(${table.updatedAt}, ${table.publishedAt}) desc`, table.id.desc().nullsFirst()).where(sql`${table.status} <> 'archived'`),
  index("stories_revision_of_idx").on(table.revisionOf).where(sql`${table.revisionOf} IS NOT NULL`),
  index("stories_series_published_idx").on(table.seriesSlug, table.publishedAt.desc().nullsFirst()).where(sql`${table.status} = 'published'`),
  index("stories_public_recency_idx").on(sql`coalesce(${table.boostedAt}, ${table.publishedAt}) desc nulls first`, table.id.asc()).where(sql`${table.status} = 'published'`),
  index("stories_section_boost_idx").on(table.section, sql`coalesce(${table.boostedAt}, ${table.publishedAt}) desc nulls first`).where(sql`${table.status} = 'published'`),
  index("stories_series_boost_idx").on(table.seriesSlug, sql`coalesce(${table.boostedAt}, ${table.publishedAt}) desc nulls first`).where(sql`${table.status} = 'published'`),
  index("stories_breaking_until_idx").on(table.breakingUntil).where(sql`${table.breakingUntil} IS NOT NULL`),
  index("stories_pinned_idx").on(table.pinned).where(sql`${table.pinned} = 1`),
]);

/**
 * شرائح «جاك العلم» — التقرير التفاعلي العمودي. المادة الأم صف في stories
 * بشكل jakalelm، وكل شريحة صف هنا: المعنى والبيانات لا الشكل (العرض قرار الواجهة).
 */
export const storySlides = pgTable("story_slides", {
  id: text("id").primaryKey(),
  storyId: text("story_id").notNull(),
  position: integer("position").notNull(),
  /** hero | text | stat | comparison | timeline | quote | list | fact | summary | end */
  type: text("type").notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  /** الرقم البارز بالأرقام اللاتينية كما ورد في المصدر — "73%"، "3.9". */
  stat: text("stat").notNull().default(""),
  statLabel: text("stat_label").notNull().default(""),
  image: text("image"),
  imageStyle: text("image_style"),
  imagePrompt: text("image_prompt").notNull().default(""),
  /** المقطع الأصلي من المصدر الذي استُخرجت منه الشريحة — للمراجعة البشرية. */
  sourceContext: text("source_context").notNull().default(""),
  hidden: integer("hidden").notNull().default(0),
  /** تفاصيل النوع: أطراف المقارنة، نقاط التسلسل، عناصر القائمة، نسبة الاقتباس. */
  data: jsonb("data"),
}, (table) => [
  index("story_slides_story_idx").on(table.storyId, table.position),
]);

/** مصدر جاك العلم النصي الأصلي — مرجع مدقق الأرقام وعمليات إعادة التوليد. */
export const jakSources = pgTable("jak_sources", {
  storyId: text("story_id").primaryKey(),
  source: text("source").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** مكتبة وسائط «تحرير العلم» — الحقوق تُفحص قبل الاستخدام (الدستور §12). */
export const media = pgTable("media", {
  id: text("id").primaryKey(),
  /** المسار العام للملف (محليًا /uploads/…؛ لاحقًا R2). */
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  rightsCleared: integer("rights_cleared").notNull().default(0),
  /** أعلام §12 مفصولة بفواصل: social-watermark, competitor-logo, gore… */
  flags: text("flags").notNull().default(""),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
  /** مولّدة بالذكاء — توسم بشفافية، وحقوقها داخلية فتُوثق تلقائيًا. */
  aiGenerated: integer("ai_generated").notNull().default(0),
}, table => [
  index("media_created_at_idx").on(table.createdAt.desc().nullsFirst()),
  index("media_rights_created_at_idx").on(table.rightsCleared, table.createdAt.desc().nullsFirst()),
]);

/** إعدادات نظام الذكاء — صف واحد jsonb يديره رئيس التحرير من اللوحة. */
export const aiSettings = pgTable("ai_settings", {
  id: text("id").primaryKey().default("main"),
  data: jsonb("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** سجل استهلاك الذكاء — أساس فرض السقوف اليومية والشهرية. */
export const aiUsage = pgTable("ai_usage", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  tool: text("tool").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  /** بالسنت تجنبًا لكسور الفاصلة العائمة. */
  costCents: integer("cost_cents").notNull().default(0),
  actor: text("actor").notNull(),
}, (table) => [index("ai_usage_at_idx").on(table.at)]);

/** مقترحات سلاسل جديدة — بشروط الدستور، والاعتماد لرئيس التحرير. */
export const seriesProposals = pgTable("series_proposals", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  valueCase: text("value_case").notNull(),
  gapCase: text("gap_case").notNull(),
  impactCase: text("impact_case").notNull(),
  proposedBy: text("proposed_by").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

/** أدوار لوحة «تحرير العلم» — الأربعة النظامية تُزرع ولا تُحذف، وما بعدها يُنشأ من الشاشة. */
export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  /** الدور النظامي محمي من الحذف، ومسؤول النظام محمي من سحب صلاحيته الشاملة. */
  isSystem: integer("is_system").notNull().default(0),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** صف واحد لكل صلاحية ممنوحة لدور — إلغاء صلاحية = حذف صف. المفاتيح من lib/tahrir/permissions.ts. */
export const rolePermissions = pgTable("role_permissions", {
  roleId: text("role_id").notNull(),
  permissionKey: text("permission_key").notNull(),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionKey] }),
]);

/** استثناء فردي فوق الدور: منح صلاحية لعضو بعينه أو منعه منها دون دور جديد. */
export const userPermissions = pgTable("user_permissions", {
  userId: text("user_id").notNull(),
  permissionKey: text("permission_key").notNull(),
  /** allow | deny */
  effect: text("effect").notNull().default("allow"),
}, (table) => [
  primaryKey({ columns: [table.userId, table.permissionKey] }),
]);

/** مستخدمو لوحة «تحرير العلم» — الدور مفتاح في roles، والحالة active | suspended. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  email: text("email").notNull().default(""),
  role: text("role").notNull().default("editor"),
  /** PBKDF2-SHA256: صيغة salt:iterations:hash بترميز hex. */
  passwordHash: text("password_hash").notNull(),
  sessionVersion: integer("session_version").notNull().default(1),
  mfaSecret: text("mfa_secret"),
  mfaLastCounter: integer("mfa_last_counter").notNull().default(-1),
  mfaRecoveryHashes: jsonb("mfa_recovery_hashes").notNull().default([]),
  status: text("status").notNull().default("active"),
  suspendedAt: text("suspended_at"),
  suspendedBy: text("suspended_by"),
  suspendReason: text("suspend_reason").notNull().default(""),
  lastLoginAt: text("last_login_at"),
  /** كلمة مرور مؤقتة (عضو جديد أو إعادة تعيين) — يُجبر على تغييرها قبل دخول اللوحة. */
  mustChangePassword: integer("must_change_password").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (table) => [uniqueIndex("users_username_normalized_uidx").on(sql`lower(btrim(${table.username}))`)]);

/** Internal editorial collaboration; never included in public content. */
export const editorialNotes = pgTable("editorial_notes", {
  id: text("id").primaryKey(),
  storyId: text("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  kind: text("kind").notNull().default("comment"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [index("editorial_notes_story_idx").on(table.storyId, table.createdAt)]);

export const editorialNotifications = pgTable("editorial_notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storyId: text("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
  readAt: text("read_at"),
}, table => [index("editorial_notifications_user_idx").on(table.userId, table.createdAt)]);

export const editorialPresence = pgTable("editorial_presence", {
  storyId: text("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  seenAt: text("seen_at").notNull(),
}, table => [primaryKey({ columns: [table.storyId, table.userId, table.sessionId] }), index("editorial_presence_seen_idx").on(table.seenAt)]);

/** لقطات منشورة قابلة للاستعادة كمسودة فقط. */
export const storyVersions = pgTable("story_versions", {
  id: text("id").primaryKey(),
  storyId: text("story_id").notNull(),
  version: integer("version").notNull(),
  data: jsonb("data").notNull(),
  actor: text("actor").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("story_versions_story_idx").on(table.storyId, table.version)]);

export const memberSavedStories = pgTable("member_saved_stories", {
  memberId: text("member_id").notNull(),
  storyId: text("story_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.memberId, table.storyId] })]);

/** عدادات مشتركة بين نسخ الخادم، بلا عناوين IP أو أسماء حسابات خام. */
export const requestLimits = pgTable("request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: text("expires_at").notNull(),
});

/** سجل تدقيق غير قابل للتعديل: كل فعل تحريري يُدوَّن. */
export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  storyId: text("story_id"),
  detail: text("detail").notNull().default(""),
  context: jsonb("context"),
}, table => [index("audit_log_story_time_idx").on(table.storyId, table.at.desc(), table.id.desc()), index("audit_log_root_story_idx").on(sql`(${table.context}->>'rootStoryId')`, table.at.desc(), table.id.desc()), index("audit_log_at_idx").on(table.at.desc().nullsFirst(), table.id.desc().nullsFirst())]);

/** ملف عضو الموقع العام — المعرّف يأتي من Neon Auth ولا يختلط بمستخدمي التحرير. */
export const memberProfiles = pgTable("member_profiles", {
  authUserId: text("auth_user_id").primaryKey(),
  avatarUrl: text("avatar_url"),
  status: text("status").notNull().default("active"),
  suspendReason: text("suspend_reason").notNull().default(""),
  onboardingCompleted: integer("onboarding_completed").notNull().default(0),
  personalizationEnabled: integer("personalization_enabled").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** قاموس اهتمامات مستقل عن أقسام الموقع وقابل للتوسع إلى موضوعات وكيانات لاحقًا. */
export const interests = pgTable("interests", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull(),
  /** مفاتيح أقسام/مصطلحات تستخدمها خوارزمية الترتيب التفسيرية الخفيفة. */
  contentKeys: jsonb("content_keys").notNull(),
  position: integer("position").notNull().default(0),
  active: integer("active").notNull().default(1),
});

/** اختيارات العضو الصريحة فقط — منفصلة عن أي إشارات مستنتجة مستقبلًا. */
export const memberInterests = pgTable("member_interests", {
  memberId: text("member_id").notNull(),
  interestId: text("interest_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.memberId, table.interestId] }),
  index("member_interests_member_idx").on(table.memberId),
  index("member_interests_interest_idx").on(table.interestId),
]);

/** إعجاب فريد: عضو + مادة. الإلغاء يحذف الصف. */
export const memberLikes = pgTable("member_likes", {
  memberId: text("member_id").notNull(),
  storyId: text("story_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.memberId, table.storyId] }),
  index("member_likes_story_idx").on(table.storyId),
]);

/**
 * أحداث تفاعل اقتصادية — لا heartbeat لكل ثانية.
 * الأنواع: article_open, reading_progress, engaged_read, like, unlike,
 * ai_summary, ai_simplify, ai_discuss, listen, related_click, closing_answer.
 */
export const memberEvents = pgTable("member_events", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  storyId: text("story_id").notNull(),
  type: text("type").notNull(),
  value: integer("value"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("member_events_member_created_idx").on(table.memberId, table.createdAt),
  index("member_events_member_story_type_idx").on(table.memberId, table.storyId, table.type),
  index("member_events_story_type_idx").on(table.storyId, table.type),
]);

/** ملخص علاقة العضو بالمادة — للقراءة السريعة بدل تجميع الأحداث الخام. */
export const memberStoryStats = pgTable("member_story_stats", {
  memberId: text("member_id").notNull(),
  storyId: text("story_id").notNull(),
  activeMs: integer("active_ms").notNull().default(0),
  maxProgress: integer("max_progress").notNull().default(0),
  visits: integer("visits").notNull().default(0),
  lastVisitAt: text("last_visit_at").notNull(),
  liked: integer("liked").notNull().default(0),
  usedAi: integer("used_ai").notNull().default(0),
  /** أسماء أدوات الذكاء المستخدمة: summary, simplify, discuss, listen */
  aiTools: jsonb("ai_tools").notNull(),
  closingAnswer: integer("closing_answer"),
  interestScore: integer("interest_score").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.memberId, table.storyId] }),
  index("member_story_stats_member_idx").on(table.memberId),
  index("member_story_stats_story_idx").on(table.storyId),
  index("member_story_stats_member_score_idx").on(table.memberId, table.interestScore),
]);

/**
 * درجات اهتمام العضو حسب مفتاح موضوعي مُسمّى:
 * interest:health | section:technology | series:absat | format:news
 */
export const memberTopicScores = pgTable("member_topic_scores", {
  memberId: text("member_id").notNull(),
  topicKey: text("topic_key").notNull(),
  kind: text("kind").notNull(),
  /** explicit | inferred | like | deep_read | ai */
  source: text("source").notNull(),
  /** millipoints — 1000 ≈ اهتمام صريح واحد */
  weight: integer("weight").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.memberId, table.topicKey] }),
  index("member_topic_scores_member_idx").on(table.memberId),
]);

/** تصنيف المادة → موضوعات، مرة واحدة أو عند تغيّر المادة — خارج مسار فتح المقال. */
export const storyTopics = pgTable("story_topics", {
  storyId: text("story_id").notNull(),
  topicKey: text("topic_key").notNull(),
  kind: text("kind").notNull(),
  weight: integer("weight").notNull().default(1000),
  /** heuristic | haiku */
  source: text("source").notNull().default("heuristic"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.storyId, table.topicKey] }),
  index("story_topics_topic_idx").on(table.topicKey),
]);

/** قائمة انتظار النشرة البريدية — المزود الخارجي (MailerLite/…) يُربط لاحقًا في M3-T3. */
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("footer"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("newsletter_subscribers_created_idx").on(table.createdAt),
]);

/** قياس القراءة العام؛ معرّف متصفح عشوائي، وجلسات تراكمية تمنع تكرار النبضات. */
export const storyReadingSessions = pgTable("story_reading_sessions", {
  visitorId: text("visitor_id").notNull(),
  storyId: text("story_id").notNull(),
  sessionId: text("session_id").notNull(),
  memberId: text("member_id"),
  activeMs: integer("active_ms").notNull().default(0),
  maxProgress: integer("max_progress").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [
  primaryKey({ columns: [table.visitorId, table.storyId, table.sessionId] }),
  check("story_reading_active_bounds", sql`${table.activeMs} between 0 and 7200000`),
  check("story_reading_progress_bounds", sql`${table.maxProgress} between 0 and 100`),
  index("story_reading_sessions_story_idx").on(table.storyId),
  index("story_reading_sessions_member_idx").on(table.memberId),
]);

/** تفاعلات الزوار: حالة واحدة لكل متصفح ومادة، منفصلة عن نبضات القراءة. */
export const visitorStoryInteractions = pgTable("visitor_story_interactions", {
  visitorId: text("visitor_id").notNull(),
  storyId: text("story_id").notNull(),
  liked: integer("liked").notNull().default(0),
  closingAnswer: integer("closing_answer"),
  likedAt: text("liked_at"),
  answeredAt: text("answered_at"),
}, (table) => [
  primaryKey({ columns: [table.visitorId, table.storyId] }),
  index("visitor_interactions_story_idx").on(table.storyId),
  check("visitor_interactions_like", sql`${table.liked} in (0, 1)`),
  check("visitor_interactions_answer", sql`${table.closingAnswer} in (0, 1)`),
]);

/** برامج البودكاست — كيان مستقل عن المواد؛ البرامج القديمة تحتفظ بمادة صفحتها في story_id. */
export const podcastShows = pgTable("podcast_shows", {
  /** رابط الصفحة /podcasts/<id> — لاتيني ثابت بعد الإنشاء. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  cover: text("cover"),
  accent: text("accent").notNull(),
  feedUrl: text("feed_url"),
  youtube: text("youtube").notNull(),
  /** مادة الصفحة القديمة؛ null لبرنامج صفحته /podcasts/<id>. */
  storyId: text("story_id"),
  visible: integer("visible").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("podcast_shows_story_idx").on(table.storyId),
  check("podcast_shows_visible", sql`${table.visible} in (0, 1)`),
]);

/** حلقات مرفوعة من اللوحة (أو مستضافة يدويًا قبلها) — ملفها في المخزن تحت object_key. */
export const podcastEpisodes = pgTable("podcast_episodes", {
  id: text("id").primaryKey(),
  showId: text("show_id").notNull().references(() => podcastShows.id),
  title: text("title").notNull(),
  guest: text("guest").notNull().default(""),
  description: text("description").notNull().default(""),
  /** اسم الملف في /podcast-audio/<filename> — فريد وثابت فيُخزَّن مؤقتًا للأبد. */
  filename: text("filename").notNull(),
  objectKey: text("object_key").notNull(),
  mime: text("mime").notNull(),
  byteLength: integer("byte_length").notNull(),
  /** بصمة المحتوى للـETag: sha256 للملفات القديمة، وETag المخزن للمرفوعة. */
  etag: text("etag").notNull(),
  durationSeconds: integer("duration_seconds"),
  publishedAt: text("published_at").notNull(),
  visible: integer("visible").notNull().default(1),
  sourceUrl: text("source_url"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  uniqueIndex("podcast_episodes_filename_idx").on(table.filename),
  index("podcast_episodes_show_time_idx").on(table.showId, table.publishedAt.desc()),
  check("podcast_episodes_visible", sql`${table.visible} in (0, 1)`),
]);

/** تقارير «جاك» HTML/CSS المستقلة — لا تختلط بمواد stories أو شرائح جاك القديمة. */
export const jakCodeReports = pgTable("jak_code_reports", {
  id: text("id").primaryKey(),
  /** رقم الرابط العام الثابت؛ يختلف عن UUID الداخلي ولا يُستخدم في الصلاحيات. */
  publicNumber: integer("public_number").notNull().default(sql`nextval('jak_code_reports_public_number_seq')`),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  image: text("image"),
  html: text("html").notNull().default(""),
  css: text("css").notNull().default(""),
  js: text("js").notNull().default(""),
  fonts: jsonb("fonts").$type<JakReportFont[]>().notNull().default([]),
  readingText: text("reading_text").notNull().default(""),
  /** يظهر في فهرس جاك فقط، وليس في الصفحة الرئيسية الإخبارية. */
  showOnHomepage: integer("show_on_homepage").notNull().default(0),
  status: text("status").notNull().default("draft"),
  authorId: text("author_id"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at"),
  sourceUrl: text("source_url"),
  sourcePostId: integer("source_post_id"),
  sourcePublishedAt: text("source_published_at"),
  sourceModifiedAt: text("source_modified_at"),
}, (table) => [
  uniqueIndex("jak_code_reports_public_number_uidx").on(table.publicNumber),
  index("jak_code_reports_status_time_idx").on(table.status, sql`coalesce(${table.sourcePublishedAt}, ${table.publishedAt}, ${table.createdAt}) desc`, table.id.desc()),
  index("jak_code_reports_homepage_time_idx").on(table.showOnHomepage, sql`coalesce(${table.sourcePublishedAt}, ${table.publishedAt}, ${table.createdAt}) desc`, table.id.desc()).where(sql`${table.status} = 'published'`),
  uniqueIndex("jak_code_reports_source_post_uidx").on(table.sourcePostId),
  check("jak_code_reports_homepage_bool", sql`${table.showOnHomepage} in (0, 1)`),
  check("jak_code_reports_status_valid", sql`${table.status} in ('draft', 'review', 'published', 'archived')`),
  check("jak_code_reports_version_positive", sql`${table.version} > 0`),
  check("jak_code_reports_public_number_positive", sql`${table.publicNumber} > 0`),
]);
