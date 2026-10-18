/**
 * كتالوج صلاحيات «تحرير العلم» — يعيش في الشيفرة (ما الذي يمكن فعله أصلًا)،
 * والقاعدة تخزّن التوزيع (من يملك ماذا). بلا اعتماديات ولا next/* ليعمل في سكربتات الزرع.
 */

export interface PermissionDef {
  key: string;
  label: string;
  description: string;
}

export interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionDef[];
}

/** صلاحية شاملة — لمسؤول النظام وحده، تغطي كل ما يُضاف لاحقًا. */
export const WILDCARD = "*";

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "stories",
    label: "المواد",
    permissions: [
      { key: "story.create", label: "إنشاء مادة", description: "فتح مسودة جديدة في المحرر." },
      { key: "story.edit.own", label: "تحرير موادّه", description: "تعديل المواد التي أنشأها بنفسه." },
      { key: "story.edit.any", label: "تحرير أي مادة", description: "تعديل مواد الآخرين وحذف مسوداتهم." },
      { key: "story.submit", label: "الرفع للاعتماد", description: "إرسال المادة إلى قائمة الاعتماد." },
      { key: "story.approve", label: "الاعتماد", description: "الموافقة على المواد المرفوعة." },
      { key: "story.publish", label: "النشر", description: "نشر المادة على الموقع وتثبيتها وتعليمها عاجلًا." },
      { key: "story.pin", label: "التثبيت", description: "تحديد تثبيت المادة في صدارة الرئيسية عند حفظها." },
      { key: "story.schedule", label: "الجدولة", description: "جدولة النشر لموعد لاحق." },
      { key: "story.archive", label: "الأرشفة", description: "إخفاء مادة منشورة مع تدوين السبب." },
      { key: "story.restore", label: "الاستعادة", description: "إعادة مادة من الأرشيف." },
    ],
  },
  {
    key: "content",
    label: "المحتوى",
    permissions: [
      { key: "jak.manage", label: "جاك العلم", description: "إضافة تقارير جاك العلم وتحرير أكوادها ومعاينتها." },
      { key: "jak.publish", label: "نشر تقارير جاك", description: "نشر تقارير جاك مباشرة وتحديث المنشور دون منح نشر الأخبار الأخرى." },
      { key: "jak.archive", label: "أرشفة تقارير جاك", description: "إخفاء تقارير جاك المنشورة." },
      { key: "jak.restore", label: "استعادة تقارير جاك", description: "إعادة تقرير مؤرشف إلى مسودة." },
      { key: "jak.delete", label: "حذف تقارير جاك نهائيًا", description: "حذف تقرير مؤرشف نهائيًا بعد تأكيد عنوانه؛ يبقى سجل العملية." },
      { key: "series.propose", label: "اقتراح سلسلة", description: "رفع مقترح سلسلة جديدة." },
      { key: "series.decide", label: "البتّ في المقترحات", description: "قبول مقترحات السلاسل أو رفضها." },
      { key: "series.visibility", label: "إظهار وإخفاء السلاسل", description: "مفتاح ظهور السلاسل المتقاعدة." },
      { key: "media.upload", label: "رفع الوسائط", description: "رفع الصور إلى المكتبة." },
      { key: "media.rights", label: "حقوق الوسائط", description: "توثيق حقوق الصور أو سحبه." },
      { key: "podcasts.manage", label: "البودكاست", description: "إضافة البرامج وتعديلها ورفع الحلقات ونشرها." },
    ],
  },
  {
    key: "ai",
    label: "الذكاء الاصطناعي",
    permissions: [
      { key: "ai.assist", label: "المساعد التحريري", description: "الاقتراحات والتحرير الشامل في المحرر." },
      { key: "ai.image", label: "توليد الصور", description: "توليد صور بالذكاء الاصطناعي." },
      { key: "ai.infographic", label: "الإنفوجرافيك", description: "استوديو الإنفوجرافيك." },
      { key: "ai.settings", label: "إعدادات الذكاء والنظام", description: "المزودون والسقوف ونبرة العلم وبوابات النشر." },
    ],
  },
  {
    key: "platform",
    label: "المنصة",
    permissions: [
      { key: "stats.view", label: "الإحصاءات", description: "شاشة الإحصاءات." },
      { key: "audit.view", label: "سجل التدقيق", description: "قراءة سجل التدقيق." },
    ],
  },
  {
    key: "admin",
    label: "الإدارة",
    permissions: [
      { key: "users.view", label: "عرض الأعضاء", description: "قائمة أعضاء الإدارة." },
      { key: "users.manage", label: "إضافة وتعديل عضو", description: "إنشاء الأعضاء وتغيير أدوارهم وكلمات مرورهم." },
      { key: "users.suspend", label: "تعليق العضوية", description: "تعليق عضوية واستئنافها." },
      { key: "roles.manage", label: "تحرير الأدوار والصلاحيات", description: "المصفوفة وإنشاء الأدوار." },
    ],
  },
];

export const PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

const PERMISSION_SET = new Set(PERMISSION_KEYS);

export function isPermissionKey(key: string): boolean {
  return PERMISSION_SET.has(key);
}

export interface SystemRole {
  id: string;
  label: string;
  description: string;
  /** الصلاحيات الافتراضية عند الزرع الأول — قابلة للتبديل من الشاشة بعدها. */
  defaults: string[];
}

export const ADMIN_ROLE = "admin";

/** الأدوار النظامية الأربعة — لا تُحذف، وتُزرع مرة واحدة ثم تُحرَّر من اللوحة. */
export const SYSTEM_ROLES: SystemRole[] = [
  {
    id: ADMIN_ROLE,
    label: "مسؤول النظام",
    description: "كل الصلاحيات بحكم التعريف، بما فيها ما يُضاف مستقبلًا.",
    defaults: [WILDCARD],
  },
  {
    id: "chief",
    label: "رئيس التحرير",
    description: "كل الصلاحيات التحريرية والبتّ في السلاسل وإعدادات الذكاء وعرض الأعضاء.",
    defaults: PERMISSION_KEYS.filter(
      (key) => !["users.manage", "users.suspend", "roles.manage", "jak.delete"].includes(key),
    ),
  },
  {
    id: "managing_editor",
    label: "مدير التحرير",
    description: "الاعتماد والنشر والجدولة والأرشفة وحقوق الوسائط.",
    defaults: [
      "story.create",
      "story.edit.own",
      "story.edit.any",
      "story.submit",
      "story.approve",
      "story.publish",
      "story.schedule",
      "story.archive",
      "jak.manage",
      "jak.publish",
      "jak.archive",
      "series.propose",
      "series.visibility",
      "media.upload",
      "media.rights",
      "podcasts.manage",
      "ai.assist",
      "ai.image",
      "ai.infographic",
      "stats.view",
      "audit.view",
    ],
  },
  {
    id: "editor",
    label: "محرر",
    description: "الكتابة والرفع للاعتماد والتثبيت والجدولة وأدوات الذكاء.",
    defaults: [
      "story.create",
      "story.edit.own",
      "story.submit",
      "story.pin",
      "story.schedule",
      "jak.manage",
      "series.propose",
      "media.upload",
      "ai.assist",
      "ai.image",
      "ai.infographic",
      "stats.view",
    ],
  },
];

/** أدوار الإصدار السابق وما يقابلها — approver كان يملك الاعتماد والنشر. */
export const LEGACY_ROLE_MAP: Record<string, string> = { approver: "managing_editor" };

export type OverrideEffect = "allow" | "deny";

export interface PermissionOverride {
  permissionKey: string;
  effect: OverrideEffect;
}

/**
 * الصلاحيات الفعلية لعضو: صلاحيات دوره، ثم استثناءاته الفردية فوقها.
 * الصلاحية الشاملة لا تُستثنى — مسؤول النظام لا يُمنع من شيء.
 */
export function resolvePermissions(
  rolePermissions: Iterable<string>,
  overrides: PermissionOverride[] = [],
): Set<string> {
  const result = new Set(rolePermissions);
  if (result.has(WILDCARD)) return result;
  for (const override of overrides) {
    if (override.effect === "allow") result.add(override.permissionKey);
    else result.delete(override.permissionKey);
  }
  return result;
}

export function hasPermission(permissions: Set<string>, key: string): boolean {
  return permissions.has(WILDCARD) || permissions.has(key);
}
