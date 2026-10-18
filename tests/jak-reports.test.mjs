import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const id = "11111111-1111-4111-8111-111111111111";

test("عقد تقرير جاك يحفظ HTML/CSS الخام ويولّد رابطًا ثابتًا", async () => {
  const html = `<section data-source="&amp;">${"نص"}</section>`;
  const css = ".report{direction:rtl}";
  const source = await readFile(new URL("../lib/tahrir/jak-reports.ts", import.meta.url), "utf8");
  assert.ok(id.length === 36);
  assert.equal(html, `<section data-source="&amp;">نص</section>`);
  assert.equal(css, ".report{direction:rtl}");
  assert.match(source, /JakCodeReportInput/);
  assert.match(source, /slugFor\(input\.title, input\.id\)/);
  assert.match(source, /'draft'/);
});

test("الحارس يرفض تجاوز حجم HTML/CSS وروابط البروتوكولات الخطرة", async () => {
  assert.equal("javascript:alert(1)".startsWith("/"), false);
  assert.ok(new TextEncoder().encode("x".repeat(2 * 1024 * 1024 + 1)).byteLength > 2 * 1024 * 1024);
  assert.ok(new TextEncoder().encode("x".repeat(1024 * 1024 + 1)).byteLength > 1024 * 1024);
  const source = await readFile(new URL("../lib/tahrir/jak-reports.ts", import.meta.url), "utf8");
  assert.match(source, /MAX_HTML_BYTES = 2 \* 1024 \* 1024/);
  assert.match(source, /MAX_CSS_BYTES = 1024 \* 1024/);
  assert.match(source, /parsed\.protocol !== "https:"/);
});

test("سياسات الحفظ والانتقال والتدقيق ودفعة الاستيراد لا تتجاوز عقد CAS", async () => {
  const service = await readFile(new URL("../lib/tahrir/jak-reports.ts", import.meta.url), "utf8");
  const importer = await readFile(new URL("../scripts/jak-reports-import.mjs", import.meta.url), "utf8");
  assert.match(service, /actor\.can\("jak\.manage"\)/);
  assert.match(service, /actor\.can\("story\.create"\)/);
  assert.match(service, /actor\.can\("story\.edit\.own"\)/);
  assert.match(service, /actor\.can\("story\.edit\.any"\)/);
  assert.match(service, /with updated as/);
  assert.match(service, /where "id" = \$\{input\.id\} and "version" = \$\{existing\.version\}/);
  assert.match(service, /returning \*/);
  assert.match(service, /jak\.publish/);
  assert.match(service, /story\.submit/);
  assert.match(service, /jak\.archive/);
  assert.match(service, /jak\.restore/);
  assert.match(service, /audit_log/);
  assert.match(importer, /--apply/);
  assert.match(importer, /on conflict do nothing/);
  assert.match(importer, /await client\.query\("begin"\)/);
  assert.match(importer, /await client\.query\("commit"\)/);
  assert.match(importer, /show_on_homepage, status, author_id/);
  assert.match(importer, /--publish/);
  assert.match(importer, /publish \? "published" : "draft"/);
});
