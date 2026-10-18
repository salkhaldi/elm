import assert from 'node:assert/strict';
import test from 'node:test';
import { buildJakDocument, jakDocumentHeaders } from '../lib/jak-report-document.ts';
import { validJakFonts, detectFont, jakFontCss, MAX_FONT_BYTES } from '../lib/jak-report-fonts.ts';
import { jakReadingText } from '../lib/jak-reading-text.ts';
import { readJakBody, isJakSameOrigin } from '../lib/tahrir/jak-request.ts';

const font = { family: 'خط التقرير', filename: '11111111-1111-4111-8111-111111111111.woff2', weight: '100 900', style: 'normal' };

test('separate JavaScript runs after report markup and cannot terminate its container', () => {
  const js = 'document.querySelector("#count").textContent="42"; const escaped="</ScRiPt><script>bad()";';
  for (const html of ['<p id="count">0</p>', '<html><head></head><body><p id="count">0</p></body></html>']) {
    const result = buildJakDocument({ html, css: '', title: 'تقرير', js, fonts: [font] });
    assert.ok(result.indexOf('<p id="count">') < result.indexOf('document.querySelector'));
    assert.equal((result.match(/<\/script>/gi) ?? []).length, 1);
    assert.match(result, /<\\\/script>/);
    assert.ok(result.indexOf('document.querySelector') < result.indexOf('</body>'));
    assert.match(result, /@font-face/);
    assert.ok(result.includes(`/jak-fonts/${font.filename}`));
  }
  assert.doesNotMatch(jakDocumentHeaders()['Content-Security-Policy'], /allow-same-origin|unsafe-eval/);
  assert.match(jakDocumentHeaders()['Content-Security-Policy'], /connect-src 'none'/);
  const standalone = '<html><head></head><body><script>const template="</body>";</script><!-- </body> --><p id="last">آخر عنصر</p></body></html>';
  const withScript = buildJakDocument({ html: standalone, css: '', title: 'تقرير', js: 'runAfterMarkup();' });
  assert.ok(withScript.includes('<script>const template="</body>";</script>'));
  assert.ok(withScript.indexOf('<p id="last">') < withScript.indexOf('runAfterMarkup();'));
  assert.ok(withScript.endsWith('<script>runAfterMarkup();</script></body></html>'));
});

test('font definitions reject URLs, path traversal, injected CSS and invalid ranges', () => {
  assert.equal(validJakFonts([font]), true);
  for (const change of [{ family: '</style>' }, { filename: '../../private.ttf' }, { filename: 'https://evil.test/font.woff2' }, { weight: '900 100' }, { weight: '400; color:red' }, { style: 'normal;}' }]) {
    assert.equal(validJakFonts([{ ...font, ...change }]), false);
    assert.equal(jakFontCss([{ ...font, ...change }]), '');
  }
  assert.equal(validJakFonts([font, font]), false);
  assert.equal(validJakFonts(Array.from({ length: 9 }, (_, i) => ({ ...font, family: `Font ${i}` }))), false);
});

test('font upload recognizes bounded font containers, not file names or supplied MIME', () => {
  const ttf = new Uint8Array(32); const view = new DataView(ttf.buffer);
  view.setUint32(0, 0x00010000); view.setUint16(4, 1); view.setUint32(20, 28); view.setUint32(24, 4);
  assert.equal(detectFont(ttf)?.extension, 'ttf');
  view.setUint32(0, 0x4f54544f); assert.equal(detectFont(ttf)?.extension, 'otf');
  view.setUint32(24, 400); assert.equal(detectFont(ttf), null);
  assert.equal(detectFont(new TextEncoder().encode('<script>alert(1)</script>')), null);
  assert.equal(detectFont(new Uint8Array(MAX_FONT_BYTES + 1)), null);
  const woff2 = new Uint8Array(60); const w = new DataView(woff2.buffer);
  w.setUint32(0, 0x774f4632); w.setUint32(8, 60); w.setUint16(12, 1); w.setUint32(16, 100); w.setUint32(20, 12);
  assert.equal(detectFont(woff2)?.extension, 'woff2');
  w.setUint32(8, 61); assert.equal(detectFont(woff2), null);
});

test('reading text includes report content without scripts, styles, metadata or hidden controls', () => {
  const html = '<html><head><title>خاص</title><style>body{color:red}</style></head><body><h1>عنوان التقرير</h1><p>نص <b>عربي</b> &amp; &#1605;&#1589;&#1583;&#1585;</p><script>secret()</script><div hidden>مخفي</div><div aria-hidden="true">مكرر</div><p style="display: none">مخفي أيضًا</p><nav>تنقل</nav><svg><text>رسم</text></svg></body></html>';
  assert.equal(jakReadingText({ html }), 'عنوان التقرير\n\nنص عربي & مصدر');
  assert.equal(jakReadingText({ html, readingText: '  نص يراجعه الفريق  ' }), 'نص يراجعه الفريق');
  assert.equal(jakReadingText({ html: '<img src="cover.png">' }), '');
  assert.equal(jakReadingText({ html: '<p>&lt;script&gt;نص&lt;/script&gt;</p>' }), '<script>نص</script>');
  assert.equal(jakReadingText({ html: '<script>غير مكتمل' }), '');
});

test('write requests require same origin and enforce actual streamed byte limits', async () => {
  const request = (origin) => new Request('https://alelm.net/api/tahrir/jak-reports', { method: 'POST', headers: origin ? { Origin: origin } : {} });
  assert.equal(isJakSameOrigin(request('https://alelm.net')), true);
  assert.equal(isJakSameOrigin(request('https://evil.test')), false);
  assert.equal(isJakSameOrigin(request()), false);
  await assert.rejects(readJakBody(new Request('https://alelm.net', { method: 'POST', body: '12345' }), 4), RangeError);
  assert.equal(new TextDecoder().decode(await readJakBody(new Request('https://alelm.net', { method: 'POST', body: '1234' }), 4)), '1234');
});
