import assert from "node:assert/strict";
import { mkdir, rm, readFile, writeFile, copyFile } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const source = process.env.TEST_DATABASE_URL || "postgresql://alialhazmi@localhost:5432/alelm_test";
if (!/^alelm_test/.test(new URL(source).pathname.slice(1))) throw new Error("Isolated TEST_DATABASE_URL named al elm_test* required");
const database = `alelm_test_jak_reports_${process.pid}`;
const url = new URL(source); url.pathname = `/${database}`;
const admin = new pg.Client({ connectionString: source });
const directory = `tmp/jak-reports-test-${process.pid}`;
let client;

const permissions = (...keys) => new Set(["jak.manage", ...keys]);
const actor = (userId, ...keys) => ({ userId, username: userId, displayName: userId, mustChangePassword: false, can: key => permissions(...keys).has(key) });
const owner = actor("owner", "story.create", "story.edit.own", "story.submit", "jak.archive");
const other = actor("other", "story.create", "story.edit.own", "story.submit");
const publisher = actor("publisher", "jak.publish", "jak.archive", "jak.restore");
const id = "11111111-1111-4111-8111-111111111111";
const input = (overrides = {}) => ({ id, expectedVersion: 0, title: "تقرير اختبار", excerpt: "موجز", image: null, html: "<main>خام</main>", css: ".x{color:red}", showOnHomepage: true, ...overrides });

await admin.connect();
try {
  await admin.query(`create database "${database}"`);
  client = new pg.Client({ connectionString: url.href });
  await client.connect();
  const databaseClient = drizzle(client);
  // Start from the previous schema with existing reports, then exercise the real backfill.
  const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
  const previous = {...journal, entries: journal.entries.filter(entry => entry.idx <= 22)};
  const baseline = `${directory}/baseline`;
  await mkdir(`${baseline}/meta`, { recursive: true });
  await writeFile(`${baseline}/meta/_journal.json`, JSON.stringify(previous));
  for (const entry of previous.entries) await copyFile(`drizzle/${entry.tag}.sql`, `${baseline}/${entry.tag}.sql`);
  await migrate(databaseClient, { migrationsFolder: baseline });
  const legacyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await client.query(`insert into jak_code_reports (id,slug,title,status,html,css,created_at,updated_at,source_post_id)
    values ($1,'قديم','تقرير قديم','published','<main>أصل</main>','main{color:red}','2020-01-01','2020-01-01',123)`, [legacyId]);
  const original = (await client.query('select * from jak_code_reports where id=$1', [legacyId])).rows[0];
  await client.query("insert into role_permissions(role_id,permission_key) values ('jak_team','story.publish'),('jak_team','story.archive'),('jak_team','story.restore')");
  await client.query("insert into user_permissions(user_id,permission_key,effect) values ('denied','story.publish','deny'),('allowed','story.archive','allow')");
  await migrate(databaseClient, { migrationsFolder: "drizzle" });
  const migratedPermissions = (await client.query("select permission_key from role_permissions where role_id='jak_team' order by permission_key")).rows.map(row => row.permission_key);
  assert.ok(migratedPermissions.includes('jak.publish') && migratedPermissions.includes('jak.archive') && migratedPermissions.includes('jak.restore'));
  assert.ok(!migratedPermissions.includes('jak.delete'), 'migration must not grant permanent deletion');
  assert.equal((await client.query("select effect from user_permissions where user_id='denied' and permission_key='jak.publish'")).rows[0].effect, 'deny');
  const migrated = (await client.query('select * from jak_code_reports where id=$1', [legacyId])).rows[0];
  const {public_number: legacyNumber, js: migratedJs, fonts: migratedFonts, reading_text: migratedText, ...preserved} = migrated;
  assert.equal(migratedJs, ''); assert.deepEqual(migratedFonts, []); assert.equal(migratedText, '');
  assert.ok(Number.isSafeInteger(legacyNumber) && legacyNumber > 0);
  assert.deepEqual(preserved, original, 'migration preserves every existing content and identity field');
  await migrate(databaseClient, { migrationsFolder: "drizzle" });
  assert.equal((await client.query('select public_number from jak_code_reports where id=$1', [legacyId])).rows[0].public_number, legacyNumber);
  // A partially adopted schema may already have assigned numbers: preserve them.
  const partialId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await client.query('alter table jak_code_reports alter column public_number drop not null');
  await client.query(`insert into jak_code_reports (id,slug,title,created_at,updated_at,public_number)
    values ($1,'أقدم','مستعاد','2010-01-01','2010-01-01',null)`, [partialId]);
  const migrationSql = (await readFile('drizzle/0023_jak_public_number.sql', 'utf8')).split('--> statement-breakpoint');
  await client.query(migrationSql[2]);
  await client.query(migrationSql[3]);
  await client.query('alter table jak_code_reports alter column public_number set not null');
  assert.equal((await client.query('select public_number from jak_code_reports where id=$1', [legacyId])).rows[0].public_number, legacyNumber, 'backfill never renumbers existing URLs');
  assert.ok((await client.query('select public_number from jak_code_reports where id=$1', [partialId])).rows[0].public_number > legacyNumber);
  globalThis.__jakReportsDb = databaseClient;
  await mkdir(directory, { recursive: true });
  await build({
    stdin: { contents: "export * from './lib/tahrir/jak-reports.ts';", resolveDir: process.cwd(), loader: "ts" },
    outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "jak-db", setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: "db-fixture", namespace: "jak-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "jak-fixture" }, () => ({ loader: "js", contents: "export const getDb=()=>globalThis.__jakReportsDb" }));
    } }],
  });
  const subject = await import(`../${directory}/subject.mjs`);

  assert.equal((await subject.getPublishedJakReportByPublicId(String(legacyNumber))).id, legacyId);
  assert.equal((await subject.getPublishedJakReportByPublicId(legacyId)).publicNumber, legacyNumber);
  const created = await subject.saveJakReport(input(), owner);
  assert.ok(created.publicNumber > legacyNumber);
  await client.query("update jak_code_reports set source_post_id = 1741 where id = $1", [id]);
  assert.equal(await subject.getPublishedJakReportBySourceId(1741), null, "draft imports cannot replace public links");
  assert.equal(await subject.getPublishedJakReportBySourceId(NaN), null);
  assert.equal(created.status, "draft");
  assert.ok(Number.isSafeInteger(created.publicNumber) && created.publicNumber > 0);
  assert.equal(await subject.getPublishedJakReportByPublicId(String(created.publicNumber)), null);
  assert.equal(await subject.getPublishedJakReportByPublicId(id), null);
  assert.equal(created.version, 1);
  assert.equal(created.html, input().html);
  const retried = await subject.saveJakReport(input(), owner);
  assert.equal(retried.publicNumber, created.publicNumber);
  assert.equal(retried.version, 1, "same stable create request is idempotent");
  await assert.rejects(subject.saveJakReport(input({ title: "محتوى مختلف" }), owner), error => error.status === 409);

  const [createdAudit] = (await client.query("select count(*)::int as n from audit_log where story_id=$1 and action='jak:report-create'", [id])).rows;
  assert.equal(createdAudit.n, 1);
  assert.equal((await subject.listJakReports({ actor: owner })).length, 1);
  assert.equal((await subject.listJakReports({ actor: other })).length, 0, "own editor cannot list another author's raw draft");
  await assert.rejects(subject.getJakReport(id, other), error => error.status === 403);
  assert.equal((await subject.getJakReport(id, owner)).id, id);

  const saved = await subject.saveJakReport(input({ expectedVersion: 1, title: "تعديل أول" }), owner);
  const contenders = await Promise.allSettled([
    subject.saveJakReport(input({ expectedVersion: saved.version, title: "متنافس 1" }), owner),
    subject.saveJakReport(input({ expectedVersion: saved.version, title: "متنافس 2" }), owner),
  ]);
  assert.equal(contenders.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(contenders.filter(result => result.status === "rejected" && result.reason.status === 409).length, 1);
  const [saveAudits] = (await client.query("select count(*)::int as n from audit_log where story_id=$1 and action='jak:report-save'", [id])).rows;
  assert.equal(saveAudits.n, 2, "only successful CAS saves are audited");

  const latest = await subject.getJakReport(id);
  const review = await subject.transitionJakReport(id, "review", latest.version, owner);
  await assert.rejects(subject.transitionJakReport(id, "draft", review.version, other), error => error.status === 403, "submit permission alone cannot return another author's review");
  const published = await subject.transitionJakReport(id, "published", review.version, publisher);
  assert.equal((await subject.getPublishedJakReportBySourceId(1741)).id, id);
  assert.equal(published.publicNumber, created.publicNumber);
  assert.equal((await subject.getPublishedJakReportByPublicId(String(created.publicNumber))).id, id);
  assert.equal((await subject.getPublishedJakReportByPublicId(id)).id, id);
  for (const bad of ['0', '-1', '01', '1.0', '1e0', '2147483648', '999999999999999999999999', 'missing', "1' OR 1=1"]) {
    assert.equal(await subject.getPublishedJakReportByPublicId(bad), null, bad);
  }
  const archived = await subject.transitionJakReport(id, "archived", published.version, publisher);
  assert.equal(await subject.getPublishedJakReportByPublicId(String(created.publicNumber)), null);
  assert.equal(await subject.getPublishedJakReportByPublicId(id), null);
  assert.equal(await subject.getPublishedJakReportBySourceId(1741), null, "archived reports cannot become redirect targets");
  await assert.rejects(subject.transitionJakReport(id, "published", archived.version, publisher), error => error.status === 409, "archived report must be restored before publishing");
  const restored = await subject.transitionJakReport(id, "draft", archived.version, publisher);
  assert.equal(restored.status, "draft");
  assert.equal(restored.publicNumber, created.publicNumber);
  const second = await subject.saveJakReport(input({id: '22222222-2222-4222-8222-222222222222'}), owner);
  assert.ok(second.publicNumber > created.publicNumber, 'new reports get unique increasing numbers');

  const [statusAudits] = (await client.query("select count(*)::int as n from audit_log where story_id=$1 and action like 'jak:report-%'", [id])).rows;
  assert.equal(statusAudits.n, 7, "create, saves and successful transitions are audited; rejected transitions are not");

  // Independent JS/fonts/text survive saves, retries and older open editors.
  const font = { family: 'Report Font', filename: '11111111-1111-4111-8111-111111111111.woff2', weight: '400', style: 'normal' };
  const enriched = await subject.saveJakReport(input({ expectedVersion: restored.version, js: 'document.body.dataset.ready="yes"', fonts: [font], readingText: 'نص التقرير الكامل' }), owner);
  const oldEditor = await subject.saveJakReport(input({ expectedVersion: enriched.version, title: 'حفظ من محرر قديم' }), owner);
  assert.equal(oldEditor.js, enriched.js); assert.deepEqual(oldEditor.fonts, [font]); assert.equal(oldEditor.readingText, enriched.readingText);
  for (const change of [{js: 42}, {js: 'a'.repeat(1024 * 1024 + 1)}, {fonts: [{ ...font, family: '</style>' }]}]) {
    await assert.rejects(subject.saveJakReport(input({ expectedVersion: oldEditor.version, ...change }), owner), error => [400, 413].includes(error.status));
  }
  const noJak = { ...owner, can: key => key !== 'jak.manage' };
  await assert.rejects(subject.saveJakReport(input({ expectedVersion: oldEditor.version }), noJak), error => error.status === 403);
  const genericPublisher = actor('generic', 'story.publish');
  await assert.rejects(subject.transitionJakReport(id, 'published', oldEditor.version, genericPublisher), error => error.status === 403, 'general publishing alone must not publish Jak');
  const direct = await subject.transitionJakReport(id, 'published', oldEditor.version, publisher);
  assert.equal(direct.status, 'published', 'Jak role may publish directly from a draft');
  await assert.rejects(subject.saveJakReport(input({ expectedVersion: direct.version }), owner), error => error.status === 403, 'non-publisher cannot modify live code');

  const deleter = actor('deleter', 'story.edit.any', 'jak.delete');
  await assert.rejects(subject.deleteJakReport(id, direct.version, direct.title, deleter), error => error.status === 409, 'archive first');
  const deletable = await subject.transitionJakReport(id, 'archived', direct.version, publisher);
  await assert.rejects(subject.deleteJakReport(id, deletable.version, deletable.title, publisher), error => error.status === 403);
  await assert.rejects(subject.deleteJakReport(id, deletable.version, deletable.title, actor('other', 'story.edit.own', 'jak.delete')), error => error.status === 403);
  await assert.rejects(subject.deleteJakReport(id, deletable.version - 1, deletable.title, deleter), error => error.status === 409);
  await assert.rejects(subject.deleteJakReport(id, deletable.version, 'wrong', deleter), error => error.status === 400);
  assert.deepEqual(await subject.deleteJakReport(id, deletable.version, deletable.title, deleter), { id });
  assert.equal(await subject.getJakReport(id), null);
  assert.equal(await subject.getPublishedJakReportByPublicId(String(deletable.publicNumber)), null);
  assert.equal((await client.query("select count(*)::int n from audit_log where story_id=$1 and action='jak:report-delete'", [id])).rows[0].n, 1);
  await assert.rejects(subject.deleteJakReport(id, deletable.version, deletable.title, deleter), error => error.status === 404);
  assert.ok(await subject.getJakReport(second.id), 'deletion leaves other reports intact');
  console.log("Jak reports integration passed: ownership filtering, stable create retry, CAS loser, status permissions, restore gate and audit atomicity.");
} finally {
  await client?.end();
  await admin.query(`drop database if exists "${database}"`);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
  delete globalThis.__jakReportsDb;
}
