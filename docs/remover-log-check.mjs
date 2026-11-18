// docs/remover-log-check.mjs — فحص متصفح فعلي لتاب «سجل العمليات» في `Order-Item-Remover.html` (Worker وهمي)
// 🔴 اتكتب مع تحديث التاب لمعيار html-builder v9.1.0: عمود المنتج اتشال · الملاحظة بلا اسم منتج ·
//    SKU لينك للـ variant · فلاتر رأس العمود server-side · ترتيب server-side · تصدير بانر مقصوص.
// التشغيل:  npm i playwright --no-save && node docs/remover-log-check.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
let pass = 0, fail = 0;
const is = (c, m, d = '') => { c ? pass++ : fail++; console.log(c ? '  ✅' : '  ❌', m, !c && d ? `\n       ${d}` : ''); };
const W = 'https://order-item-remover-worker.ecommoda-dev.workers.dev';
const TITLE = 'Shoes Hugo men sneakers kane_runn_lgny';
const ok = (o) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, ...o }) });
const row = (id, over = {}) => ({ id, timestamp: '2026-11-17T18:56:00.000Z', tool: 'order_item_remover', type: 'remove_item', employee: 'Abo_Selim',
  order_id: '700' + id, order_name: '#' + (66000 + id), sku: 'HG1 / Grey x navy / 42', product_title: TITLE, delta: -1,
  notes: `تم حذف "${TITLE}" من الأوردر — بدون استرجاع مخزون (معطّل دائمًا)`,
  extra: JSON.stringify({ productId: '9920989954370', variantId: '50433530528066', result: 'success' }), ...over });
let calls = [], total = 250;
const DATA = [
  row(1), row(2, { sku: 'NF1 / Grey / 45', extra: JSON.stringify({ result: 'success' }) }),   // صف قديم بلا معرّفات
  row(3, { extra: JSON.stringify({ productId: '1', variantId: '2', result: 'warning', statusUpdated: false, statusUpdateError: 'Value does not exist in provided choices' }) }),
  row(4, { type: 'remove_failed', notes: `فشل حذف "${TITLE}" — Shopify timeout`, extra: JSON.stringify({ error: 'Shopify timeout' }) }),
  row(5, { type: 'remove_failed', notes: 'تم إلغاء الحذف قبل تنفيذه — قيم الحالة/السبب مرفوضة', extra: JSON.stringify({ blocked: true, stage: 'preflight' }) }),
];
async function worker(route) {
  const req = route.request(), url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
  const action = url.searchParams.get('action'); calls.push({ action, p: Object.fromEntries(url.searchParams) });
  switch (action) {
    case 'get_config': return route.fulfill(ok({ version: '1.5.0' }));
    case 'get_employees': return route.fulfill(ok({ employees: [{ username: 'Abo_Selim', display_name: 'Abo Selim' }, { username: 'Other', display_name: 'Other Emp' }] }));
    case 'get_logs': return route.fulfill(ok({ entries: DATA }));
    case 'get_logs_count': return route.fulfill(ok({ total }));
    case 'get_logs_export': return route.fulfill(ok({ entries: DATA, cap: 2000, total: 2600, truncated: true }));
  }
  return route.fulfill(ok({}));
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(() => {
  sessionStorage.setItem('woc_session', JSON.stringify({ v: 1, username: 'Abo_Selim', displayName: 'Abo Selim', loginAt: new Date().toISOString() }));
  sessionStorage.setItem('woc_last_activity', String(Date.now()));
  localStorage.setItem('warehouse_ops_worker_secret', 'test-secret');
});
await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: `window.ExcelJS={Workbook:function(){this.views=[];this.addWorksheet=()=>({views:[],columns:[],addRow:(r)=>{window.__xl=(window.__xl||[]);window.__xl.push(r)}});this.xlsx={writeBuffer:async()=>new Uint8Array([1])}}}` }));
await ctx.route(`${W}/**`, worker);
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`${BASE}/Order-Item-Remover.html`); await page.waitForTimeout(500);
await page.click('#mainTabLog'); await page.waitForSelector('#logBody tr td:not([colspan])');

console.log('── الأعمدة والمحتوى');
const heads = await page.$$eval('.data-table thead th', t => t.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
is(heads.length === 7 && !heads.some(h => h.includes('المنتج')), 'الأعمدة ٧ وعمود «المنتج» مش موجود', heads.join(' | '));
const body = await page.$eval('#logBody', e => e.innerText);
is(!body.includes('Shoes Hugo'), 'اسم المنتج مش ظاهر في أي خلية (الملاحظات اتنضّفت)');
is(!body.includes('بدون استرجاع مخزون'), 'ملاحظة النجاح العادي اتشالت');
is(body.includes('Value does not exist in provided choices'), 'سبب التحذير ظاهر');
is(body.includes('فشل الحذف — Shopify timeout') && body.includes('قيم الحالة/السبب مرفوضة'), 'سبب الفشل ظاهر بلا اسم منتج (الشكلين)');
const link = await page.$eval('#logBody tr:first-child a.sku-link', a => ({ h: a.href, t: a.textContent, rel: a.rel, tg: a.target }));
is(link.h === 'https://admin.shopify.com/store/6c7e1a-53/products/9920989954370/variants/50433530528066' && link.t === 'HG1 / Grey x navy / 42', 'SKU لينك لصفحة الـ variant بالشكل المطلوب', JSON.stringify(link));
is(link.tg === '_blank' && /noopener/.test(link.rel), 'اللينك target=_blank + noopener');
const old = await page.$eval('#logBody tr:nth-child(2)', r => ({ a: r.querySelectorAll('a.sku-link').length, t: r.innerText }));
is(old.a === 0 && old.t.includes('NF1 / Grey / 45'), 'صف قديم بلا معرّفات = SKU نص عادي (مفيش لينك مكسور)');
is((await page.$$eval('#logBody tr td:nth-child(5) a.order-link', a => a.length)) === 5, 'رقم الأوردر لينك في كل الصفوف');
const dt = await page.$eval('#logBody tr:first-child', r => [r.children[0].innerText, r.children[1].innerText]);
is(/\d\d\/\d\d\/\d{4}/.test(dt[0]) && /\d\d:\d\d/.test(dt[1]), 'التاريخ والوقت عمودين منفصلين', dt.join(' | '));
is((await page.$eval('#filteredCount', e => e.textContent)) === '250', 'النتائج = العدّ من الـ Worker');
is(await page.$$eval('#logBody td.col-num, #logBody td', () => true) && (await page.$eval('.tbl-scroll', e => getComputedStyle(e).overflowY)) === 'auto', 'سكرول داخلي للجدول');
is((await page.$eval('.data-table thead th', e => getComputedStyle(e).position)) === 'sticky', 'العناوين sticky');
is(await page.$$eval('.data-table thead th .th-flt', e => e.length) >= 5, 'قمع فلتر في رأس الأعمدة الخمسة القابلة للفلترة');
is(await page.$$eval('.data-table thead th', t => t.every(h => h.querySelectorAll('.th-flt').length <= 1)), 'مفيش قمعين على نفس العمود');

console.log('── الفلاتر والترتيب (server-side)');
calls = [];
await page.click('#thSku .th-flt');
await page.waitForSelector('.srv-pop');
await page.fill('.srv-pop input[data-act="text"]', 'HG1'); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
let g = calls.find(c => c.action === 'get_logs'), c2 = calls.find(c => c.action === 'get_logs_count');
is(g?.p.sku === 'HG1' && c2?.p.sku === 'HG1', 'فلتر SKU اتبعت للصفحة وللعدّ بنفس القيمة', JSON.stringify(g?.p));
calls = []; await page.click('#thResult .th-flt'); await page.waitForSelector('.srv-pop');
await page.click('.srv-pop .srv-item:has-text("فشل")'); await page.waitForTimeout(700);
g = calls.find(c => c.action === 'get_logs'); is(g?.p.results === 'error', 'فلتر النتيجة results=error', JSON.stringify(g?.p));
await page.keyboard.press('Escape'); await page.mouse.click(5, 5);
calls = []; await page.click('#clearAllBtn'); await page.waitForTimeout(700);
g = calls.find(c => c.action === 'get_logs'); is(g && !g.p.sku && !g.p.results, 'مسح كل الفلاتر');
calls = []; await page.click('#thSku .th-lbl'); await page.waitForTimeout(500);
g = calls.find(c => c.action === 'get_logs'); is(g?.p.sortBy === 'sku' && g?.p.sortDir === 'asc', 'ترتيب تصاعدي server-side', JSON.stringify(g?.p));
await page.click('#thSku .th-lbl'); await page.waitForTimeout(400); await page.click('#thSku .th-lbl'); await page.waitForTimeout(500);
g = calls.filter(c => c.action === 'get_logs').pop(); is(!g?.p.sortBy, 'الضغطة التالتة = بلا ترتيب');
is(calls.filter(c => c.action === 'get_logs_count').every(c => !c.p.sortBy), 'العدّ بلا باراميتر ترتيب');

console.log('── التصدير');
const dl = page.waitForEvent('download').catch(() => null);
calls = []; await page.click('.act-btn.export'); await page.waitForTimeout(800);
const exp = calls.find(c => c.action === 'get_logs_export'); is(!!exp, 'التصدير بينادي get_logs_export');
const rows = await page.evaluate(() => window.__xl || []);
is(rows.length === 5 && rows.every(r => !('p' in r)), 'صفوف التصدير ٥ وبلا عمود منتج');
is(!JSON.stringify(rows).includes('Shoes Hugo'), 'ملف التصدير بلا اسم منتج');
const warn = await page.$eval('#logExportWarn', e => ({ d: getComputedStyle(e).display, t: e.innerText }));
is(warn.d !== 'none' && warn.t.includes('5 صف') && warn.t.includes('2,600'), 'بانر التقصّ ثابت بالرقمين', warn.t);
await page.click('#thSku .th-lbl'); await page.waitForTimeout(500);
await page.click('#thEmp .th-flt'); await page.waitForSelector('.srv-pop');
await page.click('.srv-pop .srv-item:has-text("Other Emp")'); await page.waitForTimeout(700);
is((await page.$eval('#logExportWarn', e => getComputedStyle(e).display)) === 'none', 'بانر التقصّ بيتمسح مع تغيير الفلتر');
is(errs.length === 0, 'صفر أخطاء JS', errs.join(' ; '));
await browser.close(); server.close();
console.log(`\n${pass} ✅  ${fail} ❌`); process.exit(fail ? 1 : 0);
