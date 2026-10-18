import { PERMISSION_GROUPS } from "./permissions";
export const AUDIT_GROUPS = [
  { id: "content", label: "المحتوى والنشر" },
  { id: "accounts", label: "الحسابات والأعضاء" },
  { id: "permissions", label: "الأدوار والصلاحيات" },
  { id: "security", label: "الدخول والأمان" },
  { id: "media", label: "الوسائط والسلاسل" },
  { id: "ai", label: "الذكاء والإعدادات" },
  { id: "other", label: "أحداث أخرى" },
] as const;
export type AuditGroup = (typeof AUDIT_GROUPS)[number]["id"];
export type AuditTone = "normal" | "success" | "warning" | "danger";
type Meta = { label: string; group: AuditGroup; tone: AuditTone };
const actions: Record<string, [string, AuditGroup, AuditTone?]> = {
  login: ["تسجيل دخول", "security"],
  "login:suspended": ["منع دخول حساب معلّق", "security", "danger"],
  "mfa:begin": ["بدء إعداد التحقق بخطوتين", "security"],
  "mfa:enable": ["تفعيل التحقق بخطوتين", "security", "success"],
  "mfa:disable": ["إيقاف التحقق بخطوتين", "security", "warning"],
  "jak:slides-save": ["حفظ شرائح جاك العلم", "content"],
  "jak:report-delete": ["حذف تقرير جاك نهائيًا", "content", "danger"],
  "jak:report-create": ["إنشاء تقرير جاك", "content"],
  "jak:report-save": ["حفظ تقرير جاك", "content"],
  "jak:report-publish": ["نشر تقرير جاك", "content", "success"],
  "jak:report-archive": ["أرشفة تقرير جاك", "content", "warning"],
  "jak:report-submit": ["رفع تقرير جاك للمراجعة", "content"],
  "jak:report-draft": ["إعادة تقرير جاك لمسودة", "content"],
  "draft:create": ["إنشاء مسودة", "content"],
  "draft:save": ["حفظ مسودة", "content"],
  "draft:delete": ["حذف مسودة", "content", "danger"],
  "status:draft": ["إعادة إلى المسودة", "content"],
  "status:review": ["رفع للاعتماد", "content"],
  "status:scheduled": ["جدولة النشر", "content"],
  "scheduled:update": ["تحديث مادة مجدولة", "content", "success"],
  "status:published": ["نشر مادة", "content", "success"],
  "story:pulse": ["نبض الظهور", "content", "success"],
  "story:pulse-end": ["انتهاء نبض الظهور", "content"],
  "status:archived": ["أرشفة مادة", "content", "warning"],
  "story:assign": ["إسناد مادة", "content"],
  "story:comment": ["ملاحظة مراجعة", "content"],
  "story:return": ["إعادة للمحرر", "content", "warning"],
  "story:unpublish": ["تحويل المنشور إلى مسودة", "content", "warning"],
  "story:archive": ["أرشفة مادة", "content", "warning"],
  "story:restore": ["استعادة من الأرشيف", "content"],
  "revision:create": ["إنشاء نسخة تعديل", "content"],
  "revision:published": ["نشر تحديث للمادة", "content", "success"],
  "revision:merged": ["دمج مسودة التعديل", "content", "success"],
  "revision:restore": ["استعادة إصدار سابق", "content"],
  "schedule:blocked": ["منع النشر بواسطة الحارس", "content", "danger"],
  "schedule:conflict": ["تعارض في النشر المجدول", "content", "warning"],
  "users:create": ["إنشاء حساب إداري", "accounts"],
  "users:update": ["تعديل حساب إداري", "accounts"],
  "users:profile": ["تحديث ملف المحرر", "accounts"],
  "users:suspend": ["تعليق حساب إداري", "accounts", "warning"],
  "users:reactivate": ["تفعيل حساب إداري", "accounts", "success"],
  "members:suspend": ["تعليق عضوية", "accounts", "warning"],
  "members:reactivate": ["تفعيل عضوية", "accounts", "success"],
  "users:reset-password": ["إعادة تعيين كلمة المرور", "security", "warning"],
  "users:recover-password": ["استعادة كلمة المرور عبر البريد", "security", "warning"],
  "users:change-password": ["تغيير كلمة المرور", "security"],
  "users:overrides": ["تعديل استثناءات الصلاحيات", "permissions", "warning"],
  "roles:create": ["إنشاء دور", "permissions"],
  "roles:update": ["تعديل دور", "permissions"],
  "roles:delete": ["حذف دور", "permissions", "danger"],
  "roles:permission": ["تغيير صلاحية دور", "permissions", "warning"],
  "media:upload": ["رفع صورة", "media"],
  "media:rights-cleared": ["توثيق حقوق صورة", "media", "success"],
  "media:rights-revoked": ["سحب توثيق حقوق صورة", "media", "warning"],
  "podcast:show-create": ["إضافة برنامج بودكاست", "media", "success"],
  "podcast:show-update": ["تعديل برنامج بودكاست", "media"],
  "podcast:episode-publish": ["نشر حلقة بودكاست", "media", "success"],
  "podcast:episode-update": ["تعديل حلقة بودكاست", "media"],
  "podcast:episode-hide": ["إخفاء حلقة بودكاست", "media", "warning"],
  "podcast:episode-show": ["إظهار حلقة بودكاست", "media", "success"],
  "series:proposal": ["اقتراح سلسلة", "media"],
  "series:proposal-accepted": ["قبول مقترح سلسلة", "media", "success"],
  "series:proposal-approved": ["قبول مقترح سلسلة", "media", "success"],
  "series:proposal-rejected": ["رفض مقترح سلسلة", "media", "warning"],
  "series:hide": ["إخفاء سلسلة", "media", "warning"],
  "series:show": ["إظهار سلسلة", "media", "success"],
  "ai:settings": ["تعديل إعدادات الذكاء", "ai"],
  "system:settings": ["تعديل إعدادات النظام", "ai", "warning"],
  "ai:image": ["توليد صورة", "ai"],
  "ai:infographic-generate": ["توليد إنفوجرافيك", "ai"],
  "ai:infographic-images": ["توليد صور الإنفوجرافيك", "ai"],
  "ai:jak-plan": ["تخطيط جاك العلم", "ai"],
  "ai:full_edit": ["تحرير شامل بالذكاء", "ai"],
  "ai:metadata": ["توليد ملحقات المادة", "ai"],
  "ai:started": ["بدء طلب للمساعد الذكي", "ai"],
  "ai:failed": ["تعذّر إكمال طلب الذكاء", "ai", "warning"],
  "ai:blocked": ["توقف طلب الذكاء عند حد الاستخدام", "ai", "warning"],
  "ai:headlines": ["توليد عناوين مقترحة", "ai"],
  "ai:excerpt": ["توليد موجز", "ai"],
  "ai:seo": ["توليد بيانات SEO", "ai"],
  "ai:proofread": ["تدقيق لغوي", "ai"],
  "ai:improve": ["تحسين الصياغة", "ai"],
  "ai:classify": ["اقتراح تصنيف المادة", "ai"],
};
export function auditMeta(action: string): Meta {
  const known = actions[action];
  if (known)
    return { label: known[0], group: known[1], tone: known[2] ?? "normal" };
  if (action.startsWith("ai:"))
    return { label: "استخدام المساعد الذكي", group: "ai", tone: "normal" };
  // Unknown actions remain explicit rather than being falsely reported as saves.
  return { label: "حدث آخر", group: "other", tone: "normal" };
}
const permissionLabels = new Map(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map(
      (permission) => [permission.key, permission.label] as const,
    ),
  ),
);
export function auditPermissionDetails(action: string, detail: string) {
  if (action !== "users:overrides" && action !== "roles:permission") return [];
  return [...detail.matchAll(/([+−-])([a-z]+(?:[._][a-z]+)+|\*)/g)].map(
    (match) => ({
      effect: match[1] === "+" ? ("allow" as const) : ("deny" as const),
      key: match[2],
      label:
        permissionLabels.get(match[2]) ??
        (match[2] === "*" ? "كل الصلاحيات" : match[2]),
    }),
  );
}
export function auditSummary(row: {
  action: string;
  detail: string;
  storyTitle?: string | null;
}) {
  if (row.storyTitle) return row.storyTitle;
  const permissions = auditPermissionDetails(row.action, row.detail);
  if (permissions.length) {
    const subject =
      row.action === "users:overrides"
        ? row.detail.split(" — ")[0]
        : row.detail.slice(0, row.detail.indexOf(":"));
    const allow = permissions.filter((p) => p.effect === "allow").length;
    return `${subject} — ${[allow ? `سماح بـ ${allow} ${allow >= 3 && allow <= 10 ? "صلاحيات" : "صلاحية"}` : "", permissions.length - allow ? `منع ${permissions.length - allow} ${permissions.length - allow >= 3 && permissions.length - allow <= 10 ? "صلاحيات" : "صلاحية"}` : ""].filter(Boolean).join("، ")}`;
  }
  if (row.action === "login") return "دخول إلى لوحة التحكم";
  if (row.action === "users:profile")
    return row.detail.endsWith(": name")
      ? "تحديث الاسم المعروض"
      : row.detail.endsWith(": remove")
        ? "إزالة الصورة الشخصية"
        : row.detail.endsWith(": image")
          ? "تحديث الصورة الشخصية"
          : "تحديث بيانات الملف";
  if (/^[0-9a-f-]{36}(?::|$)/i.test(row.detail)) {
    if (row.action === "members:suspend")
      return row.detail.slice(38) || "تعليق وصول العضو";
    if (row.action === "members:reactivate") return "إعادة تفعيل وصول العضو";
    return "المعرّف المرجعي متاح في التفاصيل";
  }
  if (row.action.startsWith("ai:")) {
    const parts = row.detail.split(" · ");
    const arabicPart = parts.find((part) => /[\u0600-\u06ff]/.test(part));
    return arabicPart || "بيانات التنفيذ والمزوّد متاحة في التفاصيل";
  }
  return row.detail || "لا توجد تفاصيل إضافية";
}
