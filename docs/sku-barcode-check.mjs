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
      { title: 'U.S. Polo Assn. Shoes', variantTitle: 'Black / 43', sku: 'FL-PO-10 / Black / 43', barcode: '34271298', quantity: 1, image: null, variantId: '801', productId: '901' },
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
// 🔴 **أوردر تالت للتراكينج بس** (v1.16.0). قبل كده كان `BOSTA123` بيرجّع
//    `#53769` — وكان **صح** وقتها لأن البند ⑥ (الحذف) كان بيشيل المجموعة
//    دي من الجدول قبل البند ⑦. الاستبعاد بقى **شطب مش حذف** فالمجموعة
//    بتفضل موجودة، ونداء التراكينج كان هيترفض كتكرار **والاختبار يعدّي**
//    من غير ما يجرّب التحويل أصلاً.
ORDERS['#53770'] = {
  orderId: '5678901234570', orderName: '#53770',
  financialStatus: 'PENDING', fulfillmentStatus: 'UNFULFILLED',
  itemsTruncated: false, itemsCap: 100,
  items: [
    { title: 'Bosta shipment order', variantTitle: 'Black / 42', sku: 'BS1 / Black / 42', barcode: '77112299', quantity: 2, image: null },
  ],
};
const BY_ID = Object.fromEntries(Object.values(ORDERS).map(o => [o.orderId, o]));

// 🔴 **رد الـ Worker بيتولّد في `route.fulfill` مش في سيرفر تاني.**
//    الصفحة بتنادي `https://…workers.dev`، و`route.continue({url})` مش
//    بيسمح بتغيير البروتوكول (`https` → `http`) — فالاعتراض بيرد بنفسه.
// متغيّرات لبحث الـ SKU (`search_sku` · v1.2.0 من الـ Worker).
// ⚠️ `RN-AD-115` جزئي **بيطابق تلاتة** — ده بالظبط اللي بيطلّع قايمة
//    الاختيار، والتطابق التام بيتضاف على طول من غير قايمة.
// ⚠️ `available` و`productId` **جداد في Worker 1.3.0** — الكمية بقت المتاح
//    على شوبيفاي، والـ SKU بقى لينك لصفحة المتغيّر. و`913` **بلا مخزون
//    معروف** (`available: null`) عشان بند «`—` مش صفر» يتفحص فعلاً.
const VARIANTS = [
  { variantId: '911', productId: '701', sku: 'RN-AD-115 / Black / 45', barcode: '41202242', available: 4,    title: 'Adidas Terrex', variantTitle: '45', productStatus: 'ACTIVE', image: null },
  { variantId: '912', productId: '701', sku: 'RN-AD-115 / Beige / 43', barcode: '39072322', available: 0,    title: 'Adidas Terrex', variantTitle: '43', productStatus: 'ACTIVE', image: null },
  { variantId: '913', productId: '701', sku: 'RN-AD-115 / Blue / 43',  barcode: null,       available: null, title: 'Adidas Terrex', variantTitle: '43', productStatus: 'ACTIVE', image: null },
];

// صفوف السجل الوهمية — `log_print` بيزوّد عليها، وتاب السجل بيقراها.
const LOG_ROWS = [];

function workerReply(url, body) {
  const u = new URL(url);
  const a = u.searchParams.get('action');

  if (url.includes('order-sku-barcode-printer-worker')) {
    if (a === 'get_config') return [200, { ok: true, version: '1.3.0' }];
    if (a === 'get_order') {
      const id  = u.searchParams.get('id');
      const raw = u.searchParams.get('order');
      const o = id ? BY_ID[id] : ORDERS[raw?.startsWith('#') ? raw : '#' + raw];
      if (!o) return [404, { error: `الأوردر ${id || raw} مش موجود` }];
      return [200, { ok: true, ...o }];
    }
    // 🔴 **المطابقة هنا نسخة من `buildSkuQuery` بتاع الـ Worker** (v1.2.1):
    //    كل كلمة في المدخل بتبقى شرط **بادئة** لوحدها، والشروط بـ AND.
    //    `includes()` (اللي كان هنا لحد v1.15.0) كان **بيخفي الباج**:
    //    بيرجّع نتيجة على `SD1 / Light grey / 45` بينما شوبيفاي الحقيقي
    //    بيرجّع صفر، فالاختبار كان بيعدّي والأداة مكسورة.
    if (a === 'search_sku') {
      const term = (u.searchParams.get('term') || '').trim();
      if (term.length < 3) return [400, { error: 'اكتب ٣ حروف على الأقل' }];
      const toks = term.toLowerCase().replace(/["\\()*:]/g, ' ').split(/[\s/]+/).filter(Boolean);
      const variants = VARIANTS.filter(v => {
        const words = v.sku.toLowerCase().split(/[\s/]+/).filter(Boolean);
        return toks.every(t => words.some(w => w.startsWith(t)));
      });
      return [200, { ok: true, term, variants, truncated: false, cap: 50 }];
    }
    // 🔴 نفس شكل الصفوف اللي الـ Worker بيبنيها في `buildPrintLogRows`.
    if (a === 'log_print') {
      const ts = new Date().toISOString();
      for (const o of (body?.orders || [])) {
        const n = o.items.reduce((s, i) => s + i.copies, 0);
        LOG_ROWS.push({ timestamp: ts, tool: 'order_sku_barcode_printer', type: 'print',
                        employee: body.employee, order_id: o.orderId, order_name: o.orderName,
                        sku: null, delta: n, notes: `${n} باركود-SKU · ${o.items.length} صنف` });
      }
      for (const i of (body?.skuItems || [])) {
        LOG_ROWS.push({ timestamp: ts, tool: 'order_sku_barcode_printer', type: 'print_sku',
                        employee: body.employee, order_id: null, order_name: null,
                        sku: i.sku, delta: i.copies, notes: `${i.copies} باركود-SKU · بدون أوردر` });
      }
      return [200, { ok: true, rows: LOG_ROWS.length }];
    }
    if (a === 'get_logs')       return [200, { ok: true, entries: LOG_ROWS.slice().reverse() }];
    if (a === 'get_logs_count') return [200, { ok: true, total: LOG_ROWS.length }];
    return [400, { error: 'unknown' }];
  }
  // Worker التغليف — تحويل التراكينج + قايمة الموظفين لفلتر السجل
  if (a === 'get_config') return [200, { ok: true, version: '2.5.0' }];
  if (a === 'get_employees') return [200, { ok: true, employees: [{ username: 'Tester', display_name: 'Tester' }] }];
  if (a === 'get_order' && u.searchParams.get('tracking') === 'BOSTA123') {
    return [200, { ok: true, order: { name: '#53770' } }];
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
  // ⚠️ جسم الـ POST لازم يتقرا هنا — `log_print` بيعتمد عليه بالكامل.
  let sent = null;
  try { sent = JSON.parse(route.request().postData() || 'null'); } catch { /* GET */ }
  const [status, body] = workerReply(url, sent);
  return route.fulfill({
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
});

await page.goto(`${BASE}/sku-barcode.html`, { waitUntil: 'networkidle' });

// ── ① الأربع مداخل موجودة ─────────────────────────────────────
for (const [id, label] of [['orderScanInput', 'شوبيفاي'], ['bostaScanInput', 'بوسطة'],
                           ['orderManualInput', 'يدوي'], ['skuTermInput', 'SKU']]) {
  check(`مربع ${label} موجود`, await page.locator(`#${id}`).count() === 1);
}
check('المربع النشط الافتراضي = شوبيفاي',
  await page.locator('#entryCard-shopify.is-active').count() === 1);
// v1.14.0 — كارت «اسكن باركود…» اتشال، والزراير التلاتة اتشالوا معاه.
for (const [id, label] of [['bcIdle', 'كارت «اسكن باركود…»'], ['bcClearBtn', 'زرار «مسح الدفعة»'],
                           ['bcOneEachBtn', 'زرار «نسخة لكل صنف»'], ['bcByQtyBtn', 'زرار «بالكمية»']]) {
  check(`${label} اتشال`, await page.locator(`#${id}`).count() === 0);
}
check('تاب «سجل العمليات» موجود', await page.locator('#mainTabLog').count() === 1);
// v1.16.0 — اسم التاب بقى «طباعة ملصق الباركود-SKU»، و«ليبل» اتشالت من الواجهة.
check('اسم التاب بقى «طباعة ملصق الباركود-SKU»',
  (await page.locator('#mainTabPrint').textContent()).includes('ملصق الباركود-SKU'));
check('كلمة «ليبل» اتشالت من واجهة تاب الطباعة',
  !/ليبل/.test(await page.locator('#printTabContent').innerText()));
// 🔴 مفيش `placeholder` ولا سطر شرح تحت أي مربع — العنوان واللون هما التعريف.
check('مفيش أي placeholder في المربعات الأربعة',
  await page.locator('#printTabContent input[placeholder]:not([placeholder=""])').count() === 0);
check('سطور «Scanner Gun…» اتشالت', await page.locator('.scan-hint').count() === 0);
// 🔴 المدخل الرابع بياخد صف لوحده بعرض الشبكة — مش عمود رابع.
const skuWide = await page.evaluate(() => {
  const g = document.querySelector('.entry-grid').getBoundingClientRect();
  const c = document.getElementById('entryCard-sku').getBoundingClientRect();
  const a = document.getElementById('entryCard-shopify').getBoundingClientRect();
  return { same: Math.abs(g.width - c.width) < 2, below: c.top > a.bottom - 1 };
});
check('كارت الـ SKU بعرض الصفحة', skuWide.same);
check('كارت الـ SKU تحت باقي المربعات', skuWide.below);
check('`.entry-grid-4` اتشالت', await page.locator('.entry-grid-4').count() === 0);

// ── ② إضافة أوردر بالاسم (الإدخال اليدوي) ─────────────────────
await page.fill('#orderManualInput', '53768');
await page.click('#bcManualBtn');
await page.waitForFunction(() => document.querySelectorAll('tr.bc-grp').length === 1);
check('الأوردر اتضاف للدفعة', await page.locator('tr.bc-grp').count() === 1);
check('٣ أصناف اتعرضوا', await page.locator('tr.bc-item').count() === 3);
check('بادج الأوردرات = 1', await page.locator('#bcStatOrders').textContent() === '1');
check('بادج الأصناف = 3',   await page.locator('#bcStatItems').textContent() === '3');
check('الصنف اللي مالوش باركود مربعه مقفول',
  await page.locator('.bc-qty:disabled').count() === 1);
check('الصنف اللي مالوش باركود قيمته صفر',
  await page.locator('.bc-qty:disabled').inputValue() === '0');
// 🔴 عمود الـ Barcode اتشال — بس **غيابه لسه بيتقال** تحت الـ SKU.
check('«مفيش Barcode» لسه معروض بعد ما العمود اتشال',
  await page.locator('.bc-nobar').count() === 1);
check('عدد النسخ الافتراضي = الكمية (1 + 2 = 3)',
  /طباعة 3 باركود-SKU/.test(await page.locator('#bcPrintBtn').textContent()));
// v1.14.0 — الأعمدة أربعة: صورة · SKU · الكمية · عدد الطباعة.
check('الجدول أربع أعمدة (المنتج والـ Barcode اتشالوا)',
  await page.locator('.bc-table thead th').count() === 4);

// ── ③ الأوردر المكرّر بيترفض ──────────────────────────────────
await page.fill('#orderManualInput', '#53768');
await page.click('#bcManualBtn');
await page.waitForTimeout(400);
check('الأوردر المكرّر ما اتضافش', await page.locator('tr.bc-grp').count() === 1);

// ── ④ ماسح شوبيفاي بالـ ID الرقمي ─────────────────────────────
await page.fill('#orderScanInput', '5678901234568');
await page.press('#orderScanInput', 'Enter');
await page.waitForFunction(() => document.querySelectorAll('tr.bc-grp').length === 2);
check('الأوردر التاني اتضاف بالـ ID', await page.locator('tr.bc-grp').count() === 2);
check('عدد النسخ بقى 5 (3 + 2)',
  /طباعة 5 باركود-SKU/.test(await page.locator('#bcPrintBtn').textContent()));

// ── ⑤ الأوردر الفاشل بيفضل معروض باسمه (بانر مش شيلة) ─────────
await page.fill('#orderManualInput', '99999');
await page.click('#bcManualBtn');
await page.waitForFunction(() => document.querySelectorAll('#bcFails .bc-fail-row').length === 1);
check('الأوردر الفاشل معروض باسمه في البانر',
  (await page.locator('#bcFails .bc-fail-row').textContent()).includes('99999'));
check('الفشل ما زوّدش مجموعات في الجدول', await page.locator('tr.bc-grp').count() === 2);
await page.locator('#bcFails .bc-fail-x').click();
check('سطر الفشل بيتقفل', await page.locator('#bcFails .bc-fail-row').count() === 0);

// ── ⑥ الاستبعاد بيشطب الصنف — مابيشيلوش من الجدول (v1.16.0) ───
//
// 🔴 البند ده بيقفل رجوع الحذف من العرض: الاستبعاد لازم يفضل **مرئي**،
//    وإلا الموظف مايعرفش هو استبعد الصنف ولا الجلب ما رجّعوش أصلاً.
// 🔴 **الأحدث فوق** (v1.19.0) — الأوردر اللي اتضاف دلوقتي لازم يبقى أول
//    مجموعة في الجدول، مش آخر واحدة. البند ده بيقفل رجوع ترتيب الإضافة.
check('آخر أوردر اتضاف هو أول مجموعة في الجدول',
  (await page.locator('tr.bc-grp').first().innerText()).includes('#53769'),
  await page.locator('tr.bc-grp').first().innerText());
const beforeRows = await page.locator('tr.bc-item').count();
await page.locator('tr.bc-item .bc-row-x').first().click();
await page.waitForSelector('tr.bc-item.is-off');
check('الاستبعاد مابيشيلش الصف من الجدول',
  await page.locator('tr.bc-item').count() === beforeRows);
check('الصف المستبعَد مشطوب', await page.locator('tr.bc-item.is-off').count() === 1);
check('خانة عدد الطباعة بقت صفر ومقفولة',
  await page.locator('tr.bc-item.is-off .bc-qty').inputValue() === '0' &&
  await page.locator('tr.bc-item.is-off .bc-qty:disabled').count() === 1);
check('العدد الكلي نقص بعدد نسخ الصنف المستبعَد',
  /طباعة 3 باركود-SKU/.test(await page.locator('#bcPrintBtn').textContent()),
  await page.locator('#bcPrintBtn').textContent());
// 🔴 الضغطة التانية بترجّعه بعدده اللي كان — من غير رجوع، الاستبعاد
//    بالغلط بيتصلّح بإعادة سكان الأوردر كله.
await page.locator('tr.bc-item.is-off .bc-row-x').click();
await page.waitForFunction(() => document.querySelectorAll('tr.bc-item.is-off').length === 0);
check('الضغطة التانية بترجّع الصنف',
  /طباعة 5 باركود-SKU/.test(await page.locator('#bcPrintBtn').textContent()),
  await page.locator('#bcPrintBtn').textContent());
check('المجموعات ما اتشالتش', await page.locator('tr.bc-grp').count() === 2);
// نستبعد صنف تاني ونسيبه مستبعَد لباقي الفحص (٥ − ١ = ٤ نسخة).
await page.locator('tr.bc-item .bc-row-x').first().click();
await page.waitForSelector('tr.bc-item.is-off');

// ── ⑦ مربع بوسطة: تراكينج → أوردر عن طريق Worker التغليف ──────
await page.fill('#bostaScanInput', 'BOSTA123');
await page.press('#bostaScanInput', 'Enter');
await page.waitForFunction(() => document.querySelectorAll('tr.bc-grp').length === 3);
check('تراكينج بوسطة اتحوّل لأوردر',
  (await page.locator('#bcBody').textContent()).includes('#53770'));
// 🔴 v1.16.0 — صف المجموعة بقى **رقم الأوردر وبس**.
check('بادج تراكينج بوسطة اتشال من صف المجموعة',
  !(await page.locator('#bcBody').textContent()).includes('BOSTA123'));
check('عدّاد «N صنف» اتشال من صف المجموعة',
  await page.locator('.bc-grp-n').count() === 0);
// 🔴 بادجات الحالة اتشالت — لازم تفضل مشيلة.
check('بادجات PENDING/UNFULFILLED اتشالت',
  !/PENDING|UNFULFILLED/.test(await page.locator('#bcBody').textContent()));

// ── ⑧ مدخل الـ SKU: القايمة بتفتح بالكتابة + تحديد متعدد (v1.17.0) ──
//
// 🔴 **المودال اتشال** — القايمة بقت منسدلة تحت المربع، وبتفتح من غير
//    ما حد يدوس «بحث». والصفوف بقت **مربعات اختيار** مش زراير بتضيف على
//    طول: البحث الجزئي بيرجّع كل المقاسات، والموظف بياخد منهم كذا واحد.
check('مودال اختيار الصنف اتشال', await page.locator('#skuPickOverlay').count() === 0);
await page.locator('#skuTermInput').type('RN-AD-115', { delay: 20 });
// نص الانتظار بقى «جاري البحث عن…» (كان «بيدوّر على…») — v1.17.0.
// ⚠️ **بيتفحص بنداء `bcAcBusy` مباشرةً مش بانتظار الـ DOM** — الـ Worker
//    الوهمي بيرد في نفس اللحظة، فحالة الانتظار بتظهر وتختفي في إطار
//    واحد والانتظار عليها **بيعلّق الاختبار** (حصل فعلاً).
const busyTxt = await page.evaluate(() => { bcAcBusy('اختبار'); return document.querySelector('#skuAcBox .sku-ac-busy').innerText; });
check('نص الانتظار بقى «جاري البحث عن…»', busyTxt.includes('جاري البحث عن'), busyTxt);
await page.waitForSelector('#skuAcBox .bc-pick-row');
check('الكتابة لوحدها بتفتح القايمة المنسدلة',
  await page.locator('#skuAcBox:not([hidden])').count() === 1);
check('الجزئي بيطلّع تلات نتايج', await page.locator('#skuAcBox .bc-pick-row').count() === 3);
check('الصنف بلا باركود مربعه مقفول',
  await page.locator('#skuAcBox .bc-pick-cb:disabled').count() === 1);
check('المربع ما اتفضّاش وانت بتكتب',
  await page.locator('#skuTermInput').inputValue() === 'RN-AD-115');
// 🔴 v1.17.0 — الصف بقى الـ SKU وبس: اسم المنتج ورقم الباركود اتشالوا.
const pickTxt = await page.locator('#skuAcBox .bc-pick-row').first().innerText();
check('صف النتيجة فيه الـ SKU', pickTxt.includes('RN-AD-115 / Black / 45'), pickTxt);
check('اسم المنتج اتشال من صف النتيجة', !pickTxt.includes('Adidas Terrex'), pickTxt);
check('رقم الباركود اتشال من صف النتيجة', !pickTxt.includes('41202242'), pickTxt);
// «مفيش Barcode» **لازم يفضل** — هو اللي بيقول إن الصنف مش هيتطبع خالص.
check('«مفيش Barcode» لسه ظاهر في القايمة',
  (await page.locator('#skuAcBox .bc-pick-row.no-bar').innerText()).includes('مفيش Barcode'));

// ── ⑧أ التحديد المتعدد و«تحديد الكل» ──────────────────────────
check('زرار «إضافة المحدد» متعطّل قبل أي تحديد',
  await page.locator('#bcAcAddBtn:disabled').count() === 1);
// 🔴 **الشريط فوق النتايج، ملزوق تحت مربع الإدخال** (v1.19.0). كان في آخر
//    القايمة، فالموظف بيحدّد فوق وينزل يدوّر على الزرار.
const barPos = await page.evaluate(() => {
  const bar = document.querySelector('#skuAcBox .sku-ac-bar');
  const row = document.querySelector('#skuAcBox .bc-pick-row');
  return { above: bar.getBoundingClientRect().top < row.getBoundingClientRect().top,
           stick: getComputedStyle(bar).position };
});
check('شريط التحديد فوق نتايج البحث', barPos.above);
check('الشريط ثابت مع التمرير (sticky)', barPos.stick === 'sticky');
// ⚠️ **المحدِّد بيسمّي صف نتيجة صراحةً** — «تحديد الكل» بياخد نفس كلاس
//    المربعات، وهو بقى **أول** `.bc-pick-cb` في الـ DOM بعد ما الشريط طلع
//    فوق (v1.19.0). `.first()` من غير `.bc-pick-row` كان بيعلّم «الكل».
await page.locator('#skuAcBox .bc-pick-row .bc-pick-cb:not([disabled])').first().check();
check('الزرار بيقول العدد بعد التحديد',
  /\(1\)/.test(await page.locator('#bcAcAddBtn').textContent()),
  await page.locator('#bcAcAddBtn').textContent());
// 🔴 «تحديد الكل» **مابيحددش المقفول** — وإلا «إضافة ٣» بتضيف اتنين بصمت.
await page.locator('#bcAcAll').check();
check('«تحديد الكل» بيحدّد الاتنين اللي ليهم باركود بس',
  /\(2\)/.test(await page.locator('#bcAcAddBtn').textContent()),
  await page.locator('#bcAcAddBtn').textContent());
check('الصنف بلا باركود فضل غير محدّد',
  await page.locator('#skuAcBox .bc-pick-cb:disabled').isChecked() === false);
await page.locator('#bcAcAddBtn').click();
await page.waitForFunction(() => document.querySelectorAll('tr.bc-grp.is-sku').length === 1);
// ⚠️ **العدّ بمؤشر المجموعة مش بـ `~`** — مجموعة «بدون أوردر» بقت **أول**
//    مجموعة (آخر إدخال فوق · v1.19.0)، والمحدِّد الشقيق كان هيعدّ صفوف
//    الأوردرات اللي بعدها كمان. و`bcQty_0_*` بيثبت **الاتنين**: عدد الصفوف
//    وإن المجموعة دي هي رقم صفر فعلاً.
check('الصنفين اتضافوا لمجموعة «بدون أوردر» وهي أول مجموعة',
  await page.locator('#bcBody .bc-qty[id^="bcQty_0_"]').count() === 2 &&
  await page.locator('tr.bc-grp').first().evaluate(el => el.classList.contains('is-sku')));
// 🔴 الدفعة بتتضاف **بترتيب القايمة** — أول محدَّد فوق (مش مقلوبة).
check('الدفعة اتضافت بنفس ترتيب القايمة',
  await page.evaluate(() => bcOrders[0].rows.map(r => r.sku).join(' | ')) ===
    'RN-AD-115 / Black / 45 | RN-AD-115 / Beige / 43',
  await page.evaluate(() => bcOrders[0].rows.map(r => r.sku).join(' | ')));
check('القايمة بتتقفل بعد الإضافة', await page.locator('#skuAcBox:not([hidden])').count() === 0);
check('المربع بيتفضّى بعد الإضافة', await page.locator('#skuTermInput').inputValue() === '');
check('مجموعة «بدون أوردر» مش محسوبة في بادج الأوردرات',
  await page.locator('#bcStatOrders').textContent() === '3',
  await page.locator('#bcStatOrders').textContent());

// ── ⑧ب الكمية = المتاح على شوبيفاي · والـ SKU لينك (v1.17.0) ───
//
// 🔴 `available: 4` → الكمية 4 وعدد الطباعة 4 (زي صفوف الأوردر بالظبط).
//    `available: 0` → الكمية 0 بس عدد الطباعة **1**: صفر في خانة الطباعة
//    معناه ورق فاضي، والحالة اللي المدخل ده اتعمل عشانها مخزونها صفر غالبًا.
const skuRows = await page.evaluate(() => {
  const g = bcOrders.find(o => o.isSku);
  return g.rows.map(r => ({ sku: r.sku, q: r.quantity, c: r.copies }));
});
check('الكمية = المتاح على شوبيفاي',
  skuRows.find(r => r.sku.includes('Black / 45'))?.q === 4, JSON.stringify(skuRows));
check('عدد الطباعة بيتبع الكمية', skuRows.find(r => r.sku.includes('Black / 45'))?.c === 4);
check('المتاح صفر → الكمية صفر وعدد الطباعة 1',
  skuRows.find(r => r.sku.includes('Beige / 43'))?.q === 0 &&
  skuRows.find(r => r.sku.includes('Beige / 43'))?.c === 1, JSON.stringify(skuRows));
const skuLink = await page.evaluate(() => {
  const a = [...document.querySelectorAll('.bc-sku a.bc-sku-link')];
  return { n: a.length, href: a[0]?.getAttribute('href') || '', rel: a[0]?.getAttribute('rel') || '' };
});
check('الـ SKU بقى لينك لصفحة المتغيّر',
  /\/products\/\d+\/variants\/\d+$/.test(skuLink.href), skuLink.href);
check('اللينك على كل الصفوف اللي ليها variant', skuLink.n >= 3, String(skuLink.n));
check('اللينك عليه rel="noopener"', skuLink.rel.includes('noopener'));

// ── ⑧ج الـ SKU الكامل بمسافات (باج Worker 1.2.1) ──────────────
//
// 🔴 الاستعلام القديم كان بيقسّم `RN-AD-115 / Beige / 43` لكلمات بحث
//    عامة ويرجّع **صفر** على صنف موجود. الـ Worker الوهمي بيطابق بنفس
//    منطق `buildSkuQuery` بالظبط.
await page.fill('#skuTermInput', 'RN-AD-115 / Black / 45');
await page.press('#skuTermInput', 'Enter');
await page.waitForTimeout(500);
check('التطابق التام على صنف موجود بالفعل بيقول كده',
  !(await page.locator('#skuAcBox:not([hidden])').count()));
check('مفيش سطر فشل على الـ SKU الكامل', await page.locator('#bcFails .bc-fail-row').count() === 0);

// ── ⑧ب الجدول على المعيار الموحّد: كل خلية متوسّطة (v1.16.0) ───
const tblAlign = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.bc-table th, .bc-table tbody tr.bc-item td')];
  const bad = cells.filter(c => getComputedStyle(c).textAlign !== 'center').length;
  const line = [...document.querySelectorAll('.bc-table tbody tr.bc-item td:not(:first-child)')]
    .every(c => parseFloat(getComputedStyle(c).borderInlineStartWidth) > 0);
  return { n: cells.length, bad, line };
});
check('كل خلايا الجدول متوسّطة (هيدر وجسم)', tblAlign.bad === 0,
  `${tblAlign.bad} من ${tblAlign.n} مش متوسّطة`);
check('خطوط رأسية خفيفة بين الأعمدة', tblAlign.line);

// ── ⑨ الصورة بتفتح بالحجم الكامل ──────────────────────────────
await page.evaluate(() => {
  // الـ Worker الوهمي بيرجّع `image: null` — بنحط صورة عشان الزرار يترسم.
  bcOrders[0].rows[0].image = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  bcRenderAll();
});
await page.locator('.bc-thumb-btn').first().click();
check('الضغط على الصورة بيفتح العرض الكامل',
  await page.locator('#bcLightbox.open').count() === 1);
await page.locator('.bc-lb-x').click();
check('العرض الكامل بيتقفل', await page.locator('#bcLightbox.open').count() === 0);

// ── ⑩ الليبل: SKU + باركود · **من غير رقم أوردر** ─────────────
await page.evaluate(() => window.print = () => {});   // منع فتح نافذة الطباعة
const expected = await page.evaluate(() => bcTotalCopies());
await page.click('#bcPrintBtn');
await page.waitForFunction(() => document.querySelectorAll('#printArea .print-label').length > 0);

const labels = await page.evaluate(() => [...document.querySelectorAll('#printArea .print-label')].map(el => ({
  sku:      el.querySelector('.lbl-sku-text')?.textContent || '',
  children: el.children.length,
  bars:     el.querySelectorAll('svg rect').length,
})));
check(`عدد الليبلات = ${expected}`, labels.length === expected, `طلع ${labels.length}`);
// 🔴 البند ده بيقفل رجوع سطر رقم الأوردر — سطرين بس (نص + SVG).
check('الليبل سطرين بس — مفيش سطر رقم أوردر',
  await page.locator('#printArea .lbl-order-text').count() === 0 &&
  labels.every(l => l.children === 2),
  JSON.stringify(labels.map(l => l.children)));
check('كل ليبل فيه باركود مرسوم', labels.every(l => l.bars > 10));
check('نص الليبل هو الـ SKU مش الباركود',
  labels[0].sku === 'RN-AD-115 / Black / 45', labels[0].sku);
// 🔴 **ورق الطباعة بنفس ترتيب الشاشة** — أول ليبل من أول مجموعة في الجدول.
//    ترتيب مختلف بين الاتنين = الموظف مايعرفش يقسّم الكومة على الأوردرات
//    (مفيش رقم أوردر على الليبل من v1.15.0).
check('ترتيب الطباعة = ترتيب الشاشة (الأحدث الأول)',
  labels[0].sku === await page.evaluate(() => bcOrders[0].rows.find(r => r.barcode && r.copies > 0).sku),
  labels[0].sku);
check('المعاينة بنفس عدد الليبلات',
  await page.locator('#bcPreviewGrid .print-label').count() === expected);

// ── ⑪ الليبل جوّه ميزانية الارتفاع (١ إنش) ────────────────────
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

// ── ⑫ 🔴 الصفحات الفاضية — البند اللي الملف اتكتب عشانه ───────
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

// ── ⑬ المسح التلقائي بعد الطباعة + تسجيل D1 ───────────────────
//
// 🔴 البند ده بيقفل حاجتين مع بعض: إن الدفعة **بتتمسح لوحدها** بعد
//    الطباعة (مفيش زرار مسح أصلاً)، وإن الصف اتكتب في D1 **قبل** المسح.
//    لو التسجيل اتنقل بعد `window.print()` يومًا، الصف بيضيع لو الموظف
//    قفل التاب والنافذة مفتوحة — والبند ده هيمسك ده.
await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
await page.waitForFunction(() => document.getElementById('bcResultCard').style.display === 'none');
check('الدفعة بتتمسح تلقائيًا بعد الطباعة',
  await page.locator('#bcResultCard').isHidden());

// ── ⑭ تاب سجل العمليات ────────────────────────────────────────
await page.click('#mainTabLog');
await page.waitForFunction(() => !!document.querySelector('#logBody tr td'));
const logRows = await page.locator('#logBody tr').count();
check('السجل فيه صفوف بعد الطباعة', logRows >= 2, `${logRows} صف`);
check('صف «بدون أوردر» متسجّل بـ print_sku',
  (await page.locator('#logBody').textContent()).includes('بدون أوردر'));
check('فلتر الموظف اتعبّى من Worker التغليف',
  await page.locator('#logFilterEmployee option').count() === 2);
await page.click('#mainTabPrint');
check('الرجوع لتاب الطباعة شغّال',
  await page.locator('#printTabContent').isVisible());

// ── ⑮ صفر أخطاء في الكونسول ───────────────────────────────────
check('صفر أخطاء JS', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

const bad = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
console.log(`\n${results.length - bad.length}/${results.length} عدّت`);
process.exit(bad.length ? 1 : 0);
