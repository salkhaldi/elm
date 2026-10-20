import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Real production ISR responses: the first request previously emitted two raw
// Location headers, which HTTP/2 proxies combine into an invalid comma-joined URL.
const directory = await mkdtemp(path.join(tmpdir(), 'alelm-redirects-'));
const next = path.resolve('node_modules/next/dist/bin/next');
const env = { ...process.env, DATABASE_URL: '', NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' };
delete env.NEXT_DIST_DIR;
let server;
let output = '';
async function write(name, value) {
  const target = path.join(directory, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value);
}
async function response(port, route, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`http://127.0.0.1:${port}${route}`, { method }, result => {
      result.resume();
      result.on('end', () => resolve(result));
    });
    request.setTimeout(10000, () => request.destroy(new Error('HTTP timeout')));
    request.on('error', reject);
    request.end();
  });
}
try {
  await symlink(path.resolve('node_modules'), path.join(directory, 'node_modules'), 'dir');
  await write('package.json', JSON.stringify({ private: true, type: 'module' }));
  await write('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', noEmit: true, allowImportingTsExtensions: true, paths: { '@/*': ['./*'] } } }));
  await write('lib/content/redirects.ts', await readFile('lib/content/redirects.ts', 'utf8'));
  await write('next.config.ts', `import {LEGACY_REDIRECTS,LEGACY_STORY_REWRITES,LEGACY_QUERY_REWRITES} from './lib/content/redirects';
    export default { experimental: { cpus: 2 }, async redirects() {return LEGACY_REDIRECTS}, async rewrites() {return {beforeFiles:LEGACY_QUERY_REWRITES,afterFiles:LEGACY_STORY_REWRITES,fallback:[]}} };`);
  // Exercise the actual short-link handler and URL builder on a production server.
  // The provider boundary exposes a published story, or null for missing/draft IDs.
  await write('app/[section]/[id]/route.ts', await readFile('app/[section]/[id]/route.ts', 'utf8'));
  await write('lib/content/types.ts', await readFile('lib/content/types.ts', 'utf8'));
  await write('lib/content/canonical-stories.ts', await readFile('lib/content/canonical-stories.ts', 'utf8'));
  await write('lib/content/provider.ts', `export const seedContentProvider = {
    async getStory(id: string): Promise<any> {
      if (id === '264631') return {id, section:'sciences', slug:'طعام-المستقبل'};
      if (id === '74689') return {id, section:'varieties', slug:'حقيقة-الدرج-اللانهائي'};
      if (id === '1658') return {id, section:'world', slug:'خطط-دولية-ربما-تجبر-الشركات-الكبرى-على-2'};
      return null;
    }
  };`);
  await write('app/[section]/[id]/[slug]/page.jsx', `export default async function Page({params}) {
    return <main>{(await params).id}</main> }`);
  // A competing one-segment section route reproduces the original routing bug.
  await write('app/[section]/page.jsx', `export default async function Page({params}) {
    return <main>section:{(await params).section}</main> }`);
  // Exercise Jak's real numeric and historical UUID routes alongside generic story routes.
  for (const file of ['app/jak/[id]/route.ts', 'app/jak/[id]/[slug]/page.tsx', 'lib/jak-urls.ts', 'lib/jak-report-types.ts', 'lib/jak-report-fonts.ts']) {
    await write(file, await readFile(file, 'utf8'));
  }
  await write('lib/tahrir/jak-reports.ts', `export async function getPublishedJakReportByPublicId(id: string) {
    return ['1', '11111111-1111-4111-8111-111111111111'].includes(id)
      ? { id:'11111111-1111-4111-8111-111111111111', publicNumber:1, slug:'الفيفا-لعبة-المال', title:'الفيفا', status:'published' } : null;
  }`);
  await write('lib/jak-sharing.ts', `import {jakReportHref} from './jak-urls';
    export function jakReportMetadata(report: any) {return {alternates:{canonical:jakReportHref(report)}}}`);
  await write('components/jak-code-frame.tsx', 'export function JakCodeFrame({id}: {id:string;title:string}) {return <iframe title="report" src={"/api/jak-reports/"+id+"/document"}/>}');
  await write('app/layout.jsx', 'export default function Layout({children}) { return <html><body>{children}</body></html> }');
  await write('app/page.jsx', 'export default function Page() {return <main>ready</main>}');
  for (const [route, method] of [['permanent', 'permanentRedirect'], ['temporary', 'redirect']]) {
    await write(`app/${route}/[id]/page.jsx`, `import {${method}} from 'next/navigation';
      export const revalidate=1; export function generateStaticParams(){return []}
      export default async function Page({params}) {const {id}=await params; ${method}('/target/'+encodeURIComponent(decodeURIComponent(id)))}`);
  }
  await write('app/target/[id]/page.jsx', 'export default async function Page({params}) {return <main>{(await params).id}</main>}');
  const build = spawn(process.execPath, [next, 'build', directory, '--webpack'], { cwd: directory, env });
  build.stdout.on('data', value => { output += value; });
  build.stderr.on('data', value => { output += value; });
  const [code] = await once(build, 'exit');
  assert.equal(code, 0, output);
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  server = spawn(process.execPath, [next, 'start', directory, '-p', String(port)], { cwd: directory, env });
  server.stdout.on('data', value => { output += value; });
  server.stderr.on('data', value => { output += value; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await response(port, '/')).statusCode === 200) { ready = true; break; } } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  for (const [route, status] of [['permanent', 308], ['temporary', 307]]) {
    for (const phase of ['cold', 'cached', 'expired', 'regenerated']) {
      if (phase === 'expired' || phase === 'regenerated') await new Promise(resolve => setTimeout(resolve, 1500));
      const result = await response(port, `/${route}/arabic-%D8%AE%D8%A8%D8%B1`);
      const locations = result.rawHeaders.filter((_, index) => index % 2 === 0 && result.rawHeaders[index].toLowerCase() === 'location');
      assert.equal(result.statusCode, status, `${route} ${phase}`);
      assert.equal(locations.length, 1, `${route} ${phase}: duplicate raw Location headers`);
      assert.equal(result.headers.location, '/target/arabic-%D8%AE%D8%A8%D8%B1');
      assert.equal((await response(port, result.headers.location)).statusCode, 200);
    }
  }
  console.log('Canonical redirect regression: 307/308 cold, cached, expired and regenerated responses passed.');
  const canonical = '/sciences/264631/' + encodeURIComponent('طعام-المستقبل');
  for (const method of ['GET', 'HEAD']) {
    for (const route of ['/sciences/264631', '/old-section/264631', '/uncategorized/264631', '/' + encodeURIComponent('غير-مصنف') + '/264631']) {
      const result = await response(port, route, method);
      assert.equal(result.statusCode, 301, `${method} ${route}`);
      assert.equal(result.headers.location, canonical, `${method} ${route}: must redirect directly to the published canonical`);
      assert.equal(result.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'location').length, 1);
      assert.equal((await response(port, result.headers.location, method)).statusCode, 200);
    }
    for (const id of ['missing-id', 'draft-id', '264631' + '0'.repeat(64), '%20', '%2F']) {
      const result = await response(port, `/sciences/${id}`, method);
      assert.equal(result.statusCode, 404, `${method} ${id}`);
      assert.equal(result.headers.location, undefined);
      assert.equal(result.headers['cache-control'], 'no-store');
    }
  }
  const query = '?utm_source=x&ref=%D8%A7%D9%84%D8%B9%D9%84%D9%85';
  const slash = await response(port, '/sciences/264631/' + query);
  assert.equal(slash.statusCode, 308);
  assert.equal(slash.headers.location, '/sciences/264631' + query);
  const short = await response(port, slash.headers.location);
  assert.equal(short.statusCode, 301);
  assert.equal(short.headers.location, canonical + query);
  assert.equal((await response(port, short.headers.location)).statusCode, 200);
  const jakCanonical = '/jak/1/' + encodeURIComponent('الفيفا-لعبة-المال');
  for (const method of ['GET', 'HEAD']) {
    for (const id of ['1', '11111111-1111-4111-8111-111111111111']) {
      const short = await response(port, '/jak/' + id + query, method);
      assert.equal(short.statusCode, 301);
      assert.equal(short.headers.location, jakCanonical + query);
      assert.equal((await response(port, short.headers.location, method)).statusCode, 200);
      for (const slug of ['alias', encodeURIComponent('الفيفا-لعبة-المال')]) {
        const result = await response(port, '/jak/' + id + '/' + slug, method);
        if (id === '1' && slug !== 'alias') {
          assert.equal(result.statusCode, 200);
          assert.equal(result.headers.location, undefined);
        } else {
          assert.equal(result.statusCode, 308);
          assert.equal(result.headers.location, jakCanonical);
          assert.equal(result.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'location').length, 1);
          assert.equal((await response(port, result.headers.location, method)).statusCode, 200);
        }
      }
    }
    for (const id of ['missing', 'draft', 'archived', '2147483648']) {
      const result = await response(port, '/jak/' + id, method);
      assert.equal(result.statusCode, 404);
      assert.equal(result.headers.location, undefined);
      assert.match(result.headers['cache-control'], /no-store/);
      assert.equal((await response(port, '/jak/' + id + '/alias', method)).statusCode, 404);
    }
  }
  const jakHtml = await (await fetch('http://127.0.0.1:' + port + jakCanonical)).text();
  assert.ok(jakHtml.includes('/api/jak-reports/11111111-1111-4111-8111-111111111111/document'), 'iframe keeps internal UUID');
  assert.ok(jakHtml.includes('rel="canonical" href="' + jakCanonical + '"'), 'numeric canonical metadata');
  console.log('Jak short links: GET/HEAD numeric, old UUID, Arabic slug, canonical metadata, iframe identity and missing/draft IDs passed.');
  console.log('Social short links: GET/HEAD, old sections, Arabic paths, query strings, trailing slash and missing/draft IDs passed.');
  for (const method of ['GET', 'HEAD']) {
    for (const [id, target] of [['264631', canonical], ['74689', '/varieties/74689/'+encodeURIComponent('حقيقة-الدرج-اللانهائي')], ['1658', '/world/1660/'+encodeURIComponent('خطط-دولية-ربما-تجبر-الشركات-الكبرى-على')]]) {
      for (const query of ['', '?utm_source=google&ref=%D8%A7%D9%84%D8%B9%D9%84%D9%85', '?id=999&section=wrong&ref=a&ref=b']) {
        const result = await response(port, '/'+id+query, method);
        assert.equal(result.statusCode, 301, `${method} /${id}${query}`);
        assert.equal(result.headers.location, target+query);
        assert.equal(result.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'location').length, 1);
        assert.equal((await response(port, result.headers.location, method)).statusCode, 200);
      }
    }
    for (const id of ['999999999', '0', '264631'+'0'.repeat(64)]) {
      const missing = await response(port, '/'+id, method);
      assert.equal(missing.statusCode, 404);
      assert.equal(missing.headers.location, undefined);
      assert.equal(missing.headers['cache-control'], 'no-store');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    for (const alias of ['/264631/old-title', '/264631/'+encodeURIComponent('عنوان-عربي'), '/264631/old-title/amp']) {
      const result = await response(port, alias + query, method);
      assert.equal(result.statusCode, 301, method + ' ' + alias);
      assert.equal(result.headers.location, canonical + query);
      assert.equal((await response(port, result.headers.location, method)).statusCode, 200);
    }
    for (const alias of ['/999999999/old-title', '/999999999/old-title/amp']) {
      assert.equal((await response(port, alias, method)).statusCode, 404);
    }
    const wpQuery = await response(port, '/?p=264631&utm_source=old', method);
    assert.equal(wpQuery.statusCode, 301);
    assert.equal(wpQuery.headers.location, canonical + '?p=264631&utm_source=old');
    assert.equal((await response(port, '/?p=999999999', method)).statusCode, 404);
  }
  console.log('Legacy WordPress ID/slug, AMP and query permalinks resolve directly, including missing IDs.');
  const numericSlash = await response(port, '/74689/?utm_source=google');
  assert.equal(numericSlash.statusCode, 308);
  assert.equal(numericSlash.headers.location, '/74689?utm_source=google');
  assert.equal((await response(port, numericSlash.headers.location)).statusCode, 301);
  for (const section of ['sciences', 'news', '123abc']) {
    const result = await response(port, '/'+section);
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers.location, undefined);
    const html = await (await fetch(`http://127.0.0.1:${port}/${section}`)).text();
    assert.match(html.replace(/<!--.*?-->/g, ''), new RegExp('section:'+section));
  }
  // أشكال ووردبريس التي كانت ترد 404 في Search Console: الأرشيف والترقيم والخلاصات والذيول.
  for (const [route, target] of [
    ['/category/ksa', '/ksa'],
    ['/category/ksa/page/24', '/ksa?p=24'],
    ['/ksa/page/24', '/ksa?p=24'],
    ['/ksa/feed', '/ksa'],
    ['/page/26', '/'],
    ['/jakalelm', '/jak'],
    ['/wp-content/uploads/2021/11/report.pdf', 'https://dash.alelm.net/wp-content/uploads/2021/11/report.pdf'],
  ]) {
    const result = await response(port, route);
    assert.equal(result.statusCode, 308, 'legacy shape ' + route);
    assert.equal(result.headers.location, target, 'legacy shape ' + route);
  }
  // الشرطة الأخيرة تُزال أولًا بـ308 قياسية، ثم تعمل قاعدة البحث على الرابط النظيف.
  const wpSlash = await response(port, '/page/26/?s=%D8%BA%D8%B2%D8%A9');
  assert.equal(wpSlash.statusCode, 308);
  assert.equal(wpSlash.headers.location, '/page/26?s=%D8%BA%D8%B2%D8%A9');
  const wpSearch = await response(port, wpSlash.headers.location);
  assert.equal(wpSearch.statusCode, 308);
  // Next يمرر معامل `s` الأصلي أيضًا؛ صفحة البحث تقرأ `q` وهي noindex فلا أثر للزائد.
  assert.match(wpSearch.headers.location, /^\/search\?/u, 'بحث ووردبريس لا يصل صفحة البحث');
  assert.match(wpSearch.headers.location, /q=%D8%BA%D8%B2%D8%A9/u, 'كلمة البحث ضاعت في التحويل');
  const rootSearch = await response(port, '/?s=%D8%BA%D8%B2%D8%A9');
  assert.equal(rootSearch.statusCode, 308);
  assert.match(rootSearch.headers.location, /^\/search\?/u);
  assert.match(rootSearch.headers.location, /q=%D8%BA%D8%B2%D8%A9/u);
  assert.equal((await response(port, '/?p=264631')).statusCode, 301, 'قاعدة البحث ابتلعت روابط ?p=');
  for (const tail of ['/264631/old-title/feed', '/264631/feed', '/264631/old-title/contact', '/264631/old-title/print']) {
    const result = await response(port, tail);
    assert.equal(result.statusCode, 301, 'tail ' + tail);
    assert.equal(result.headers.location, canonical, 'tail ' + tail);
  }
  // خلاصات RSS الجذرية بلا تحويل عمدًا (قرار docs/seo/search-console-2026-09-08.md):
  // في الإنتاج ترد 404 لأن feed ليس قسمًا؛ هنا يكفي إثبات غياب أي تحويل.
  for (const feed of ['/feed', '/comments/feed']) {
    const result = await response(port, feed);
    assert.equal(result.headers.location, undefined, 'خلاصة جذرية محوَّلة: ' + feed);
    assert.ok(result.statusCode < 300 || result.statusCode >= 400, feed);
  }
  console.log('Legacy WordPress archives, pagination, search, media and article tails resolve without 404; root feeds stay 404.');
  console.log('Indexed numeric links: direct GET/HEAD 301 to canonical, preserved queries, section isolation, missing IDs and trailing slash passed.');
} finally {
  if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); }
  await rm(directory, { recursive: true, force: true });
}
