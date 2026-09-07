// ══════════════════════════════════════════════════════════════
// docs/sku-barcode-check.mjs — فحص متصفح فعلي لصفحة `sku-barcode.html`
// ══════════════════════════════════════════════════════════════
//
// 🔴 **ليه ملف اختبار منفصل عن `browser-check.mjs`:** ده بيشغّل
//    `print.html` على Worker وهمي بشكل رد مختلف تمامًا (طابور طباعة
//    وبوسطة). دمج الاتنين معناه Worker وهمي واحد بيرد على أداتين، وأول
//    تعديل في رد واحدة بيكسر اختبار التانية.
//
// 🔴 **البند رقم ⑩ هو سبب وجود الملف ده.** «٥ ليبل بيطلعوا ٣٧ صفحة» ما
//    اتمسكش في أي مراجعة كود ولا في فحص CSS بالبارسر — اتمسك بعدّ
//    الصفحات في متصفح. الفحص بيقيس **ارتفاع `document.body` وقت الطباعة**
//    مقسومًا على ارتفاع الورقة (١ إنش = 96px): لو باقي الصفحة لسه واخد
//    مكانه في التخطيط، الرقم بيطلع أكبر من عدد الليبلات بمراحل.
//
// ⚠️ **JsBarcode بتتقدّم من `node_modules` مش من الـ CDN.** الاختبار
//    بيعترض رابط jsdelivr ويرد بالملف المحلي: من غير كده الاختبار بيعتمد
//    على شبكة خارجية، وحارس `bcLibReady()` بيقفل زرار الطباعة فالبنود من
//    ⑧ لـ ⑩ **بتفشل لسبب مالوش علاقة بالكود**.
//
// التشغيل:
//   npm i playwright jsbarcode@3.11.6 --no-save
//   PW_CHROMIUM=/path/to/chromium node docs/sku-barcode-check.mjs
//   (`PW_CHROMIUM` اختياري — لو Playwright نزّل كروميوم بنفسه سيبه فاضي)

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PX_PER_IN = 96;

// ── Worker وهمي ────────────────────────────────────────────────
const ORDERS = {
  '#53768': {
    orderId: '5678901234567', orderName: '#53768',
    financialStatus: 'PENDING', fulfillmentStatus: 'UNFULFILLED',
    itemsTruncated: false, itemsCap: 100,
    items: [
      { title: 'U.S. Polo Assn. Shoes', variantTitle: 'Black / 43', sku: 'FL-PO-10 / Black / 43', barcode: '34271298', quantity: 1, image: null },
      { title: 'Flat Sneakers Lacoste',  variantTitle: 'White / 43', sku: 'FL-LA-10 / White / 43', barcode: '63804482', quantity: 2, image: null },
      { title: 'Item with no barcode',   variantTitle: null,         sku: 'NOBC-1',               barcode: null,       quantity: 3, image: null },
    ],
  },
  '#53769': {
    orderId: '5678901234568', orderName: '#53769',
    financialStatus: 'PAID', fulfillmentStatus: 'UNFULFILLED',
    itemsTruncated: false, itemsCap: 100,
    items: [
      { title: 'North Face Glenclyffe', variantTitle: 'Grey x Green / 44', sku: 'LW1 / Grey x Green / 44', barcode: '68219970', quantity: 2, image: null },
    ],
  },
};
const BY_ID = Object.fromEntries(Object.values(ORDERS).map(o => [o.orderId, o]));

// 🔴 **رد الـ Worker بيتولّد في `route.fulfill` مش في سيرفر تاني.**
//    الصفحة بتنادي `https://…workers.dev`، و`route.continue({url})` مش
//    بيسمح بتغيير البروتوكول (`https` → `http`) — فالاعتراض بيرد بنفسه.
function workerReply(url) {
  const u = new URL(url);
  const a = u.searchParams.get('action');

  if (url.includes('order-sku-barcode-printer-worker')) {
    if (a === 'get_config') return [200, { ok: true, version: '1.1.0' }];
    if (a === 'get_order') {
      const id  = u.searchParams.get('id');
      const raw = u.searchParams.get('order');
      const o = id ? BY_ID[id] : ORDERS[raw?.startsWith('#') ? raw : '#' + raw];
      if (!o) return [404, { error: `الأوردر ${id || raw} مش موجود` }];
      return [200, { ok: true, ...o }];
    }
    return [400, { error: 'unknown' }];
  }
  // Worker التغليف — تحويل التراكينج بس
  if (a === 'get_config') return [200, { ok: true, version: '2.5.0' }];
  if (a === 'get_order' && u.searchParams.get('tracking') === 'BOSTA123') {
    return [200, { ok: true, order: { name: '#53769' } }];
  }
  if (a === 'get_order') return [200, { ok: false, error: 'الشحنة غير موجودة' }];
  return [400, { error: 'unknown' }];
}

// السيرفر بيقدّم ملفات الريبو بس.
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const file = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname.slice(1));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  const type = file.endsWith('.css') ? 'text/css'
             : file.endsWith('.js')  ? 'text/javascript' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(file));
});

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// نسخة JsBarcode المحلية — نفس النسخة اللي الصفحة بتحمّلها من الـ CDN.
const JSBARCODE_PATH = path.join(ROOT, 'node_modules/jsbarcode/dist/JsBarcode.all.min.js');
if (!fs.existsSync(JSBARCODE_PATH)) {
  console.error('❌ JsBarcode مش موجودة — شغّل: npm i jsbarcode@3.11.6 --no-save');
  process.exit(2);
}
const JSBARCODE_SRC = fs.readFileSync(JSBARCODE_PATH, 'utf8');

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };

await new Promise(r => server.listen(0, r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

// ⚠️ نسخة كروميوم اللي Playwright بيدوّر عليها بتفرق حسب نسخة الحزمة.
//    `PW_CHROMIUM` بيسمح بتمرير مسار كروميوم مثبّت مسبقًا بدل تنزيل جديد.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

// الجلسة + السر + توجيه الـ Workers للسيرفر الوهمي
await page.addInitScript(() => {
  sessionStorage.setItem('woc_session', JSON.stringify({
    v: 1, username: 'Tester', displayName: 'Tester', loginAt: new Date().toISOString() }));
  localStorage.setItem('warehouse_ops_worker_secret', 'x');
});
await page.route('**/*', route => {
  const url = route.request().url();
  // الـ CDN مقفول في بيئة الاختبار — بنرد بالنسخة المحلية.
  if (url.includes('JsBarcode')) {
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: JSBARCODE_SRC });
  }
  const isWorker = url.includes('order-sku-barcode-printer-worker')
                || url.includes('orders-packing-checker-worker');
  if (!isWorker) return route.continue();
  if (route.request().method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: CORS });
  }
  const [status, body] = workerReply(url);
  return route.fulfill({
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
});

await page.goto(`${BASE}/sku-barcode.html`, { waitUntil: 'networkidle' });

// ── ① التلات مداخل موجودة ─────────────────────────────────────
for (const [id, label] of [['orderScanInput', 'شوبيفاي'], ['bostaScanInput', 'بوسطة'], ['orderManualInput', 'يدوي']]) {
  check(`مربع ${label} موجود`, await page.locator(`#${id}`).count() === 1);
}
check('مربع البحث بالـ SKU اتشال', await page.locator('#bcSkuInput').count() === 0);
check('المربع النشط الافتراضي = شوبيفاي',
  await page.locator('#entryCard-shopify.is-active').count() === 1);

// ── ② إضافة أوردر بالاسم (الإدخال اليدوي) ─────────────────────
await page.fill('#orderManualInput', '53768');
await page.click('#bcManualBtn');
await page.waitForFunction(() => document.querySelectorAll('#bcChips .bc-chip').length === 1);
check('الأوردر اتضاف للدفعة', await page.locator('#bcChips .bc-chip').count() === 1);
check('الجدول اتقسم لمجموعة واحدة', await page.locator('tr.bc-grp').count() === 1);
check('٣ أصناف اتعرضوا', await page.locator('tr.bc-item').count() === 3);
check('الصنف اللي مالوش باركود مربعه مقفول',
  await page.locator('.bc-qty:disabled').count() === 1);
check('الصنف اللي مالوش باركود قيمته صفر',
  await page.locator('.bc-qty:disabled').inputValue() === '0');
check('عدد النسخ الافتراضي = الكمية (1 + 2 = 3)',
  /طباعة 3 ليبل/.test(await page.locator('#bcPrintBtn').textContent()));

// ── ③ الأوردر المكرّر بيترفض ──────────────────────────────────
await page.fill('#orderManualInput', '#53768');
await page.click('#bcManualBtn');
await page.waitForTimeout(400);
check('الأوردر المكرّر ما اتضافش', await page.locator('#bcChips .bc-chip').count() === 1);

// ── ④ ماسح شوبيفاي بالـ ID الرقمي ─────────────────────────────
await page.fill('#orderScanInput', '5678901234568');
await page.press('#orderScanInput', 'Enter');
await page.waitForFunction(() => document.querySelectorAll('#bcChips .bc-chip').length === 2);
check('الأوردر التاني اتضاف بالـ ID', await page.locator('tr.bc-grp').count() === 2);
check('عدد النسخ بقى 5 (3 + 2)',
  /طباعة 5 ليبل/.test(await page.locator('#bcPrintBtn').textContent()));

// ── ⑤ الأوردر الفاشل بيفضل معروض باسمه ────────────────────────
await page.fill('#orderManualInput', '99999');
await page.click('#bcManualBtn');
await page.waitForFunction(() => document.querySelectorAll('#bcChips .bc-chip.is-fail').length === 1);
check('الأوردر الفاشل معروض باسمه',
  (await page.locator('#bcChips .bc-chip.is-fail').textContent()).includes('99999'));
check('الفشل ما زوّدش مجموعات في الجدول', await page.locator('tr.bc-grp').count() === 2);
await page.locator('#bcChips .bc-chip.is-fail .bc-chip-x').click();
check('شيلة الفشل بتتقفل', await page.locator('#bcChips .bc-chip.is-fail').count() === 0);

// ── ⑥ مربع بوسطة: تراكينج → أوردر عن طريق Worker التغليف ──────
await page.locator('#bcChips .bc-chip').nth(1).locator('.bc-chip-x').click();
await page.waitForFunction(() => document.querySelectorAll('#bcChips .bc-chip').length === 1);
await page.fill('#bostaScanInput', 'BOSTA123');
await page.press('#bostaScanInput', 'Enter');
await page.waitForFunction(() => document.querySelectorAll('#bcChips .bc-chip').length === 2);
check('تراكينج بوسطة اتحوّل لأوردر',
  (await page.locator('#bcChips .bc-chip').nth(1).textContent()).includes('#53769'));
check('شيلة بوسطة بلونها',
  await page.locator('#bcChips .bc-chip.src-bosta').count() === 1);
check('التراكينج معروض في صف المجموعة',
  (await page.locator('tr.bc-grp').nth(1).textContent()).includes('BOSTA123'));

// ── ⑦ «نسخة لكل صنف» / «بالكمية» ──────────────────────────────
await page.click('#bcOneEachBtn');
check('نسخة لكل صنف = 3 (الصنف بلا باركود مستبعد)',
  /طباعة 3 ليبل/.test(await page.locator('#bcPrintBtn').textContent()));
await page.click('#bcByQtyBtn');
check('بالكمية = 5', /طباعة 5 ليبل/.test(await page.locator('#bcPrintBtn').textContent()));

// ── ⑧ الليبل: SKU + باركود + رقم الأوردر ──────────────────────
await page.evaluate(() => window.print = () => {});   // منع فتح نافذة الطباعة
await page.click('#bcPrintBtn');
await page.waitForFunction(() => document.querySelectorAll('#printArea .print-label').length > 0);

const labels = await page.evaluate(() => [...document.querySelectorAll('#printArea .print-label')].map(el => ({
  sku:   el.querySelector('.lbl-sku-text')?.textContent || '',
  order: el.querySelector('.lbl-order-text')?.textContent || '',
  bars:  el.querySelectorAll('svg rect').length,
})));
check('عدد الليبلات = 5', labels.length === 5, `طلع ${labels.length}`);
check('كل ليبل عليه رقم أوردر', labels.every(l => /^#\d+$/.test(l.order)),
  JSON.stringify(labels.map(l => l.order)));
check('الترتيب أوردر ورا أوردر',
  labels.slice(0, 3).every(l => l.order === '#53768') &&
  labels.slice(3).every(l => l.order === '#53769'),
  JSON.stringify(labels.map(l => l.order)));
check('كل ليبل فيه باركود مرسوم', labels.every(l => l.bars > 10));
check('نص الليبل هو الـ SKU مش الباركود',
  labels[0].sku === 'FL-PO-10 / Black / 43', labels[0].sku);
check('المعاينة بنفس عدد الليبلات',
  await page.locator('#bcPreviewGrid .print-label').count() === 5);

// ── ⑨ الليبل جوّه ميزانية الارتفاع (١ إنش) ────────────────────
const labelBox = await page.evaluate(() => {
  const el = document.querySelector('#bcPreviewGrid .print-label');
  const r = el.getBoundingClientRect();
  const kids = [...el.children].reduce((s, k) => s + k.getBoundingClientRect().height, 0);
  return { h: r.height, w: r.width, kids };
});
check('الليبل 2×1 إنش', Math.abs(labelBox.w - 2 * PX_PER_IN) < 2 && Math.abs(labelBox.h - PX_PER_IN) < 2,
  JSON.stringify(labelBox));
check('محتوى الليبل جوّه الميزانية (مفيش قص صامت)',
  labelBox.kids + 2 * 0.1 * PX_PER_IN <= PX_PER_IN,
  `المحتوى ${labelBox.kids.toFixed(1)}px + حشو 19.2px من ${PX_PER_IN}px`);

// ── ⑩ 🔴 الصفحات الفاضية — البند اللي الملف اتكتب عشانه ───────
await page.emulateMedia({ media: 'print' });
const printMetrics = await page.evaluate(() => {
  const visible = [...document.body.children].filter(el => getComputedStyle(el).display !== 'none');
  return {
    bodyH:   document.body.getBoundingClientRect().height,
    scrollH: document.documentElement.scrollHeight,
    visible: visible.map(el => el.id || el.className || el.tagName),
  };
});
await page.emulateMedia({ media: 'screen' });

const pages = Math.ceil(printMetrics.bodyH / PX_PER_IN);
check('وقت الطباعة: `#printArea` بس هو الظاهر',
  printMetrics.visible.length === 1 && printMetrics.visible[0] === 'printArea',
  JSON.stringify(printMetrics.visible));
check('عدد صفحات الطباعة = عدد الليبلات (مفيش صفحات بيضا)',
  pages === labels.length, `ارتفاع ${printMetrics.bodyH}px ≈ ${pages} صفحة لـ ${labels.length} ليبل`);

// ── ⑪ مسح الدفعة ──────────────────────────────────────────────
await page.click('#bcClearBtn');
await page.waitForFunction(() => document.getElementById('bcIdle').style.display === '');
check('مسح الدفعة بيرجّع شاشة الفراغ',
  await page.locator('#bcResultCard').isHidden());

// ── ⑫ صفر أخطاء في الكونسول ───────────────────────────────────
check('صفر أخطاء JS', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

const bad = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`\n${results.length - bad.length}/${results.length} عدّت`);
process.exit(bad.length ? 1 : 0);
