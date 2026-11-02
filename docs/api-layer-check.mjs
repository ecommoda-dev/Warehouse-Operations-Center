#!/usr/bin/env node
/**
 * docs/api-layer-check.mjs — فحص سلوكي لطبقة النداءات `ecoApi` في shared/core.js
 *
 * بيستخرج `ECO_API_TIMEOUT_MS` + `ecoApi` من core.js بالنص ويشغّلهم في vm بـ fetch وهمي
 * (مفيش متصفح ولا dependency). الغرض: أي تعديل في الطبقة (زي إضافة apiUpload/apiGetBlob
 * لأداة ديفوهات) يثبت إن **السلوك القديم ما اتغيّرش** وإن الجديد شغّال.
 *
 *   node docs/api-layer-check.mjs      # exit 0 = تمام
 *
 * 🔴 الملف ده في الهبّين بنفس النص — core.js نسخة متطابقة بالبايت (core-twin-check.sh).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'shared', 'core.js'), 'utf8');
const from = src.indexOf('const ECO_API_TIMEOUT_MS');
const to   = src.indexOf('// §HELPERS', from);
assert.ok(from > 0 && to > from, 'مش لاقي كتلة §API في core.js');
// مهلة قصيرة للاختبار بدل 90 ثانية
const block = src.slice(from, to).replace(/ECO_API_TIMEOUT_MS\s*=\s*\d+/, 'ECO_API_TIMEOUT_MS = 150');

let calls, settingsOpened, secret;
let handler;                                   // (url, init) => Response | Promise
const ctx = vm.createContext({
  AbortController, FormData, Blob, URLSearchParams, setTimeout, clearTimeout, Error, JSON, Object, String, encodeURIComponent,
  getSecret: () => secret,
  openSettings: () => { settingsOpened = true; },
  fetch: async (url, init) => { calls.push({ url, init }); return handler(url, init); },
});
vm.runInContext(block + '\nthis.ecoApi = ecoApi;', ctx);
const api = () => ctx.ecoApi({ url: 'https://w.example/', label: 'اختبار' });

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const reset = () => { calls = []; settingsOpened = false; secret = 'sec'; handler = () => json({ ok: true }); };
const tests = [];
const test = (n, f) => tests.push([n, f]);

test('القديم: apiGet بيبعت Content-Type JSON + Authorization ويرجّع JSON', async () => {
  handler = () => json({ ok: true, v: 1 });
  const r = await api().apiGet('get_config', { a: '1' });
  assert.deepEqual({ ...r }, { ok: true, v: 1 });
  assert.equal(calls[0].url, 'https://w.example/?action=get_config&a=1');
  assert.equal(calls[0].init.method, 'GET');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.headers['Authorization'], 'Bearer sec');
  assert.ok(!('responseType' in calls[0].init), 'responseType ممنوع يتمرّر لـ fetch');
});
test('القديم: apiPost بيبعت JSON بالجسم', async () => {
  await api().apiPost('x', { a: 1 });
  assert.equal(calls[0].init.body, '{"a":1}'); assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
});
test('القديم: apiPath وapiPostRoot موجودين وبيشتغلوا', async () => {
  await api().apiPath('/logs', { a: 1 }); await api().apiPostRoot('act', { b: 2 });
  assert.equal(calls[0].url, 'https://w.example/logs'); assert.equal(calls[1].init.body, '{"action":"act","b":2}');
});
test('القديم: خطأ HTTP برسالة الـ Worker + status + payload', async () => {
  handler = () => json({ error: 'Unauthorized' }, 401);
  await assert.rejects(api().apiGet('x'), e => e.message === 'Unauthorized' && e.status === 401 && e.payload.error === 'Unauthorized');
});
test('القديم: رد مش JSON برسالة واضحة', async () => {
  handler = () => new Response('<html>oops</html>', { status: 200 });
  await assert.rejects(api().apiGet('x'), /رد غير متوقع من Worker اختبار/);
});
test('القديم: السر ناقص = openSettings + رفض بدون نداء', async () => {
  secret = '';
  await assert.rejects(api().apiGet('x'), /الإعدادات غير مكتملة/);
  assert.equal(settingsOpened, true); assert.equal(calls.length, 0);
});
test('القديم: شبكة واقعة = رسالة «تعذّر الوصول»', async () => {
  handler = () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(api().apiGet('x'), /تعذّر الوصول لـ Worker اختبار/);
});
test('القديم: cancelSignal بيلغي برسالة «اتلغى» وcancelled', async () => {
  handler = (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
  const c = new AbortController(); const p = api().apiGet('x', {}, c.signal); c.abort();
  await assert.rejects(p, e => e.cancelled === true && e.message === 'اتلغى');
});
test('القديم: المهلة بتقطع برسالة «راجع السجل»', async () => {
  handler = (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
  await assert.rejects(api().apiGet('x'), /ما ردّش خلال .* ثانية — راجع السجل قبل ما تعيد المحاولة/);
});

test('الجديد: apiUpload بيبعت FormData من غير Content-Type يدوي (المتصفح بيضيف الـ boundary)', async () => {
  const fd = new FormData(); fd.set('a', '1');
  const r = await api().apiUpload('add_defect_image', fd);
  assert.equal(r.ok, true);
  assert.equal(calls[0].url, 'https://w.example/?action=add_defect_image'); assert.equal(calls[0].init.method, 'POST');
  assert.ok(calls[0].init.body instanceof FormData);
  assert.ok(!('Content-Type' in calls[0].init.headers), 'ممنوع Content-Type يدوي مع FormData');
  assert.equal(calls[0].init.headers['Authorization'], 'Bearer sec');
});
test('الجديد: apiUpload نفس تصنيف الأخطاء (خطأ JSON من الـ Worker)', async () => {
  handler = () => json({ error: 'الصورة أكبر من الحد' }, 413);
  await assert.rejects(api().apiUpload('x', new FormData()), e => e.message === 'الصورة أكبر من الحد' && e.status === 413);
});
test('الجديد: apiGetBlob بيرجّع Blob وبيبعت Authorization ومش بيمرّر responseType', async () => {
  handler = () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  const b = await api().apiGetBlob('get_image', { id: '7' });
  assert.ok(b instanceof Blob); assert.equal(b.size, 4); assert.equal(b.type, 'image/jpeg');
  assert.equal(calls[0].url, 'https://w.example/?action=get_image&id=7');
  assert.equal(calls[0].init.headers['Authorization'], 'Bearer sec');
  assert.ok(!('responseType' in calls[0].init));
});
test('الجديد: apiGetBlob + خطأ 404 JSON = رسالة الـ Worker (مش blob)', async () => {
  handler = () => json({ ok: false, error: 'الصورة مش موجودة' }, 404);
  await assert.rejects(api().apiGetBlob('get_image', { id: '1' }), e => e.message === 'الصورة مش موجودة' && e.status === 404);
});
test('الجديد: apiGetBlob + خطأ 500 مش JSON = رسالة واضحة', async () => {
  handler = () => new Response('boom', { status: 500 });
  await assert.rejects(api().apiGetBlob('get_image'), /رد غير متوقع من Worker اختبار \(HTTP 500\)/);
});
test('الجديد: قراءة جسم الصورة بتتقطع بالمهلة كمان (جوّه نفس try)', async () => {
  handler = (u, init) => {
    const body = new ReadableStream({ start(c) { init.signal.addEventListener('abort', () => c.error(Object.assign(new Error('x'), { name: 'AbortError' }))); } });
    return new Response(body, { status: 200 });
  };
  await assert.rejects(api().apiGetBlob('get_image'), /ما ردّش خلال .* ثانية/);
});
test('الجديد: apiGetBlob بدون سر = openSettings', async () => {
  secret = ''; await assert.rejects(api().apiGetBlob('x'), /الإعدادات غير مكتملة/); assert.equal(settingsOpened, true);
});

let failed = 0;
for (const [n, f] of tests) {
  reset();
  try { await f(); console.log('  ✓ ' + n); } catch (e) { failed++; console.log('  ✗ ' + n + '\n      ' + String(e.stack || e).split('\n').slice(0, 3).join('\n      ')); }
}
console.log(`\n${tests.length - failed}/${tests.length} عدّوا`);
process.exit(failed ? 1 : 0);
