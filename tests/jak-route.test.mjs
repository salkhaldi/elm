import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";

test("Short numeric report links render and legacy UUID links redirect without loops", async () => {
  const directory = await mkdtemp("tmp/jak-route-");
  try {
    await build({
      entryPoints: ["app/jak/[id]/[slug]/page.tsx"], outfile: `${directory}/page.mjs`,
      bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "report-fixture", setup(builder) {
        builder.onResolve({ filter: /^(next\/|@\/)/ }, args => args.path.endsWith("jak-urls") ? undefined : ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", contents:
          path === "next/navigation" ? "export function notFound(){throw new Error('404')} export function permanentRedirect(path){throw new Error('308:'+path)}" :
          path.endsWith("jak-reports") ? "export async function getPublishedJakReportByPublicId(id){return ['11111111-1111-4111-8111-111111111111','1'].includes(id) ? {id:'11111111-1111-4111-8111-111111111111',publicNumber:1,slug:'الفيفا-لعبة-المال',title:'الفيفا',status:'published',excerpt:''} : null}" :
          path.endsWith("jak-code-frame") ? "export const JakCodeFrame=()=>null" :
          path.endsWith("jak-sharing") ? "export const jakReportMetadata=()=>({})" :
          path.endsWith("site-chrome") ? "export const SiteHeader=()=>null;export const SiteFooter=()=>null" : "export default ()=>null",
        }));
      } }],
    });
    const { default: page } = await import(`../${directory}/page.mjs`);
    for (const slug of ["الفيفا-لعبة-المال", encodeURIComponent("الفيفا-لعبة-المال")]) {
      assert.ok(await page({ params: Promise.resolve({ id: "1", slug }) }));
    }
    const canonical = '/jak/1/' + encodeURIComponent('الفيفا-لعبة-المال');
    for (const id of ['1', '11111111-1111-4111-8111-111111111111']) {
      for (const slug of ['alias', 'الفيفا-لعبة-المال', encodeURIComponent('الفيفا-لعبة-المال'), '%bad']) {
        if (id === '1' && ['الفيفا-لعبة-المال', encodeURIComponent('الفيفا-لعبة-المال')].includes(slug)) continue;
        await assert.rejects(page({ params: Promise.resolve({ id, slug }) }), error => error.message === '308:' + canonical);
      }
    }
    for (const id of ['missing', 'draft', 'archived']) {
      await assert.rejects(page({ params: Promise.resolve({ id, slug: 'alias' }) }), /404/);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
