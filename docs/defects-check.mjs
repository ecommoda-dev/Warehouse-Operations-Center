// docs/defects-check.mjs — فحص متصفح فعلي لـ `Defect-Products.html` مع Worker وهمي (stateful)
//
// 🔴 **ليه ملف مستقل؟** نفس قرار باقي فحوص الهب: كل صفحة عقدها مختلف. عقد ديفوهات:
//    ① الضغطة المكررة/المهلة **مابتخصمش مرتين** (نفس requestId في كل إعادة) ② الرصيد 0 = قرار الموظف مش خصم صامت
//    ③ رفع الصورة FormData **من غير Content-Type يدوي** وعرضها blob بهيدر Authorization ثم revoke
//    ④ الصف بيتنزع سلاحه أثناء التنفيذ ⑤ التصدير المقصوص ببانر.
//    كلهم **مستحيل يتمسكوا بمراجعة كود** — بيتمسكوا بتشغيل الصفحة.
//
// التشغيل:  npm i playwright --no-save && node docs/defects-check.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✅', m); };
const bad = (m, d = '') => { fail++; console.log('  ❌', m, d ? `\n       ${d}` : ''); };
const is = (c, m, d = '') => (c ? ok(m) : bad(m, d));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Worker وهمي ─────────────────────────────────────────────
const SECRET = 'test-secret';
const W = 'https://defect-products-worker.ecommoda-dev.workers.dev';
const VARIANT = { variantId: '49745809473858', inventoryItemId: '51', productId: '9714090869058', sku: 'GT1 / White / 41', barcode: '09473858',
  productTitle: 'GT1', variantTitle: 'White / 41', displayName: 'GT1', options: [], imageUrl: null, productStatus: 'ACTIVE',
  suspended: false, tracked: true, hasLevel: true, available: 5, committed: 1, onHand: 6, ineligibleReason: null };
const SUSP = { ...VARIANT, variantId: '2', sku: 'OLD / 40', barcode: '11112222', ineligibleReason: 'المنتج ده موقوف' };

const mk = (id, over = {}) => ({ id, requestId: 'req-' + id, variantId: VARIANT.variantId, sku: VARIANT.sku, barcode: VARIANT.barcode, productTitle: 'GT1', variantTitle: 'White / 41',
  defectTypeId: 1, defectTypeName: 'خياطة مفتوحة', repairable: true, side: 'right', origin: 'new', notes: 'ملاحظة ' + id, status: 'awaiting_repair',
  deductState: 'done', restockState: 'none', pendingOp: null, createdAt: '2026-11-02T08:30:00.000Z', createdBy: 'Test_Emp', imageCount: 0,
  availableBefore: 5, availableAfter: 4, ...over });

const S = { calls: [], mode: 'ok', zero: false, truncate: false, types: [{ id: 1, name: 'خياطة مفتوحة' }], rows: [], logs: [], blobUrlsRevoked: 0 };
function resetState() {
  S.calls = []; S.mode = 'ok'; S.zero = false; S.truncate = false;
  S.types = [{ id: 1, name: 'خياطة مفتوحة' }];
  S.rows = [mk(1, { imageCount: 2 }), mk(2, { status: 'unrepairable', repairable: false, side: 'left' }), mk(3, { status: 'repaired', restockState: 'done' })];
  S.logs = [
    { id: 1, timestamp: '2026-11-02T08:30:00.000Z', tool: 'defect_products', type: 'registered', employee: 'Test_Emp', sku: VARIANT.sku, product_title: 'GT1', delta: -1, value_before: 5, value_after: 4, notes: 'x', extra: JSON.stringify({ result: 'success', defectId: 1 }) },
    { id: 2, timestamp: '2026-11-02T08:31:00.000Z', tool: 'defect_products', type: 'rejected', employee: 'Test_Emp', sku: null, product_title: null, delta: null, value_before: null, value_after: null, notes: 'old row', extra: null },
  ];
}
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(80).fill(7)]);
const json = (o, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } });

async function worker(route) {
  const req = route.request(), url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
  const action = url.searchParams.get('action'), headers = req.headers();
  let body = null; const raw = req.postData();
  if (req.method() === 'POST' && (headers['content-type'] || '').includes('json')) { try { body = JSON.parse(raw); } catch {} }
  const rec = { action, method: req.method(), params: Object.fromEntries(url.searchParams), headers, body, rawLen: raw ? raw.length : 0, raw: (headers['content-type'] || '').includes('multipart') ? (req.postDataBuffer() || Buffer.alloc(0)).toString('latin1') : null };
  S.calls.push(rec);
  if (headers.authorization !== `Bearer ${SECRET}`) return route.fulfill(json({ error: 'Unauthorized' }, 401));
  const ok = (o) => route.fulfill(json({ ok: true, ...o }));
  switch (action) {
    case 'get_config': return ok({ version: '1.0.0' });
    case 'get_employees': return ok({ employees: [{ username: 'Test_Emp', display_name: 'Test Emp' }, { username: 'Other_Emp', display_name: 'Other Emp' }] });
    case 'get_defect_types': return ok({ types: S.types });
    case 'add_defect_type': { const name = body.name.trim(); const ex = S.types.find(t => t.name === name); if (ex) return ok({ status: 'already', message: 'موجود', type: ex });
      const t = { id: S.types.length + 1, name }; S.types.push(t); return ok({ status: 'success', message: 'اتضاف', type: t }); }
    case 'list_skus': { const q = url.searchParams.get('search').toLowerCase(); return ok({ variants: [VARIANT, SUSP].filter(v => v.sku.toLowerCase().includes(q) || v.productTitle.toLowerCase().includes(q)) }); }
    case 'lookup_barcode': { const b = url.searchParams.get('barcode'); return ok({ variants: [VARIANT, SUSP].filter(v => v.barcode === b) }); }
    case 'register_defect': {
      if (S.mode === 'lost') return route.abort('failed');
      if (S.zero && body.stockMode !== 'skip') return ok({ status: 'needs_decision', reason: 'zero_stock', available: 0, message: 'الرصيد المتاح لـ GT1 = 0' });
      const d = mk(100 + S.calls.filter(c => c.action === 'register_defect').length, { requestId: body.requestId, deductState: body.stockMode === 'skip' ? 'skipped' : 'done' });
      return ok({ status: 'success', message: 'اتسجّل الديفو واتخصم 1 من المخزون.', defect: d, actions: ['خصم 1 من المخزون'] });
    }
    case 'add_defect_image': return ok({ status: 'success', message: 'اتضافت الصورة.', image: { id: 9 } });
    case 'get_defect_images': return ok({ images: [{ id: 11, defectId: 1, sizeBytes: 2048, contentType: 'image/jpeg', createdAt: '2026-11-02T08:30:00.000Z', createdBy: 'Test_Emp' }, { id: 12, defectId: 1, sizeBytes: 4096, contentType: 'image/jpeg', createdAt: '2026-11-02T08:31:00.000Z', createdBy: 'Test_Emp' }] });
    case 'get_image': return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG, headers: { 'access-control-allow-origin': '*' } });
    case 'delete_defect_image': return ok({ status: 'success', message: 'اتمسحت الصورة.' });
    case 'set_status': { const r = S.rows.find(x => x.id === body.defectId); r.status = body.status; if (body.status === 'repaired') r.restockState = 'done'; return ok({ status: 'success', message: body.status === 'repaired' ? 'اتسجّلت اتصلحت واتضاف 1 للستوك.' : 'اتغيّرت الحالة.', defect: { ...r } }); }
    case 'cancel_defect': { const r = S.rows.find(x => x.id === body.defectId); r.status = 'cancelled'; return ok({ status: 'success', message: 'اتلغى التسجيل ورجع 1 للستوك.', defect: { ...r } }); }
    case 'get_defects': { let rows = [...S.rows]; const st = url.searchParams.get('statuses'); if (st) rows = rows.filter(r => st.split(',').includes(r.status)); return ok({ defects: rows }); }
    case 'get_defects_count': { let rows = [...S.rows]; const st = url.searchParams.get('statuses'); if (st) rows = rows.filter(r => st.split(',').includes(r.status)); return ok({ total: rows.length }); }
    case 'get_status_counts': return ok({ counts: { awaiting_repair: 1, unrepairable: 1, repaired: 1 }, skipped: 0, needsReview: 0 });
    case 'get_defects_export': return ok({ defects: S.rows, cap: 2000, total: S.truncate ? 5000 : S.rows.length, truncated: S.truncate });
    case 'get_logs': return ok({ entries: S.logs });
    case 'get_logs_count': return ok({ total: S.logs.length });
    case 'get_logs_export': return ok({ entries: S.logs, cap: 2000, total: S.truncate ? 5000 : S.logs.length, truncated: S.truncate });
    case 'diag': return ok({ checks: [{ ok: true, label: 'D1', detail: 'ok' }] });
  }
  return route.fulfill(json({ error: 'Unknown action' }, 404));
}

// ── المتصفح ────────────────────────────────────────────────
const browser = await chromium.launch();
const XL = `window.__xl=[];window.ExcelJS={Workbook:class{constructor(){this.xlsx={writeBuffer:async()=>new ArrayBuffer(8)}}addWorksheet(){return{columns:null,addRow(r){window.__xl.push(r)},getRow(){return{font:{}}}}}}};`;
async function openPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, permissions: [] });
  await ctx.addInitScript(() => {
    sessionStorage.setItem('woc_session', JSON.stringify({ v: 1, username: 'Test_Emp', displayName: 'Test Emp', loginAt: new Date().toISOString() }));
    sessionStorage.setItem('woc_last_activity', String(Date.now()));
    localStorage.setItem('warehouse_ops_worker_secret', 'test-secret');
    window.__revoked = 0; const rv = URL.revokeObjectURL; URL.revokeObjectURL = (u) => { window.__revoked++; return rv.call(URL, u); };
  });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: XL }));
  await ctx.route(`${W}/**`, worker);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  resetState();
  await page.goto(`${BASE}/Defect-Products.html`);
  await page.waitForSelector('#headerMount .app-header');
  return { page, ctx, errs };
}
const calls = (a) => S.calls.filter(c => c.action === a);
const visible = (page, sel) => page.locator(sel).isVisible();
async function pickProduct(page) {
  await page.fill('#entryInput', '09473858'); await page.press('#entryInput', 'Enter');
  await page.waitForSelector('#prodWrap:not([hidden])');
}
async function fillForm(page, { type = '1', rep = 'true', side = 'right', origin = 'new' } = {}) {
  await page.selectOption('#fType', type);
  await page.click(`#fRepairable button[data-v="${rep}"]`); await page.click(`#fSide button[data-v="${side}"]`); await page.click(`#fOrigin button[data-v="${origin}"]`);
}

// ═════════ ① الأساسيات والهيكل ═════════
console.log('\n① الهيكل والأمان');
{
  const { page, ctx, errs } = await openPage();
  is(await page.locator('.main-tabs-bar .main-tab-btn').count() === 3, 'ثلاث تابات رئيسية');
  is((await page.title()).includes('ديفوهات'), 'عنوان الصفحة');
  is(await page.locator('#entryInput').getAttribute('placeholder') === null, 'مربع الإدخال بلا placeholder');
  is(await page.locator('textarea[placeholder], input[placeholder]').count() === 0, 'مفيش placeholder في أي حقل');
  is(await page.locator('.entry-bar > *').count() === 2, 'مربع الإدخال: صف chips + صف إدخال بس (مفيش سطر تحته)');
  await page.waitForTimeout(300);
  is(calls('get_config').length >= 1 && calls('get_config').every(c => c.headers.authorization === `Bearer ${SECRET}`), 'get_config بهيدر Authorization');
  is(!(await visible(page, '#verStaleBtn')), 'حارس النسخة ساكت على نسخة الـ Worker الصح');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  is(overflow <= 1, 'مفيش scroll أفقي على 1440px', String(overflow));
  is(errs.length === 0, 'صفر أخطاء كونسول عند التحميل', errs.join(' | '));
  await ctx.close();
}
{
  const { page, ctx } = await openPage({ viewport: { width: 400, height: 800 } });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  is(overflow <= 1, 'موبايل 400px: صفر scroll أفقي على تاب التسجيل', String(overflow));
  await ctx.close();
}
{ // بدون جلسة → تحويل لشاشة الدخول (الحارس بيرمي)
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.route('https://cdnjs.cloudflare.com/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: XL }));
  await page.goto(`${BASE}/Defect-Products.html`); await page.waitForTimeout(500);
  is(page.url().includes('index.html') && page.url().includes('next='), 'بدون جلسة: تحويل لـ index.html?next=');
  await ctx.close();
}

// ═════════ ② مربع الإدخال الموحّد ═════════
console.log('\n② مربع الإدخال');
{
  const { page, ctx, errs } = await openPage();
  await page.fill('#entryInput', '٠٩٤٧٣٨٥٨');
  is(await page.inputValue('#entryInput') === '09473858', 'الأرقام العربي بتتحوّل لإنجليزي لحظيًا (والصفر الأول بيفضل)');
  await page.waitForTimeout(1700);
  is(!(await visible(page, '#prodWrap')), 'من غير Enter: مفيش إضافة');
  is(/ولسه ماتضافش/.test(await page.locator('#toastContainer').innerText()), 'من غير Enter: توست أحمر بعد ١٫٥ ث');
  is(calls('lookup_barcode').length === 0, 'من غير Enter: صفر نداء للـ Worker');
  await page.press('#entryInput', 'Enter'); await page.waitForSelector('#prodWrap:not([hidden])');
  is(calls('lookup_barcode').length === 1 && calls('lookup_barcode')[0].params.barcode === '09473858', 'Enter: بحث باركود بالأصفار');
  is(await page.inputValue('#entryInput') === '', 'المربع اتمسح بعد الإدخال');
  is((await page.locator('#prodCard').innerText()).includes('GT1 / White / 41'), 'كارت المنتج بالـ SKU');
  is(await page.evaluate(() => document.activeElement.id) === 'entryInput', 'الفوكس رجع للمربع');

  await page.fill('#entryInput', '99999999'); await page.press('#entryInput', 'Enter'); await page.waitForSelector('#bcFails:not([hidden])');
  is((await page.locator('#bcFails').innerText()).includes('مفيش أي صنف بالـ SKU ده على شوبيفاي'), 'باركود مجهول: صف قصير في الصندوق الأحمر');
  await page.fill('#entryInput', '1111222233334444'); await page.press('#entryInput', 'Enter');
  is((await page.locator('#bcFails').innerText()).includes('غالبًا باركودين ملزوقين'), '١٦ رقم: مرفوض (باركودين ملزوقين)');
  is(await page.locator('#bcFails .bc-fail').count() === 2, 'الفشل في الصندوق مش في أي جدول');
  await page.fill('#entryInput', '787878457'); await page.press('#entryInput', 'Enter'); await page.waitForTimeout(200);
  is(calls('lookup_barcode').at(-1).params.barcode === '787878457', '٩ أرقام (نمط البلجن [0-9]{9}): بحث باركود');
  await page.fill('#entryInput', '123456789012'); await page.press('#entryInput', 'Enter'); await page.waitForTimeout(200);
  is(calls('lookup_barcode').at(-1).params.barcode === '787878457' && (await page.locator('#bcFails').innerText()).includes('12 خانة'), '١٢ رقم: مرفوض من غير نداء (غالبًا باركودين ملزوقين)');
  await page.fill('#entryInput', '11112222'); await page.press('#entryInput', 'Enter'); await page.waitForTimeout(200);
  is((await page.locator('#bcFails').innerText()).includes('المنتج ده موقوف'), 'منتج موقوف: صندوق أحمر + مش بيتحدد');
  is((await page.locator('#prodCard').innerText()).includes('GT1 / White / 41'), 'الموقوف ما غيّرش المنتج الحالي');
  await page.click('#bcFails .bc-fails-hd button'); is(!(await visible(page, '#bcFails')), '«شيل الكل» بيفضّي الصندوق');

  await page.fill('#entryInput', 'GT1'); await page.waitForSelector('#sugg .sg-item');
  is(await page.locator('#sugg .sg-item').count() === 2, 'اقتراحات SKU من ٣ حروف (الموقوف ليه رد من الـ Worker)' + '', '');
  await page.press('#entryInput', 'ArrowDown'); await page.press('#entryInput', 'Enter'); await page.waitForTimeout(150);
  is(/متحدد بالفعل/.test(await page.locator('#toastContainer').innerText()), 'اختيار نفس المنتج تاني = مكرر (توست)');
  is(errs.length === 0, 'صفر أخطاء كونسول', errs.join(' | '));
  await ctx.close();
}

// ═════════ ③ التسجيل والخصم ═════════
console.log('\n③ التسجيل');
{
  const { page, ctx, errs } = await openPage();
  await pickProduct(page);
  await page.click('#submitBtn');
  is(/اختار نوع العيب/.test(await page.locator('#toastContainer').innerText()), 'تسجيل ناقص: توست «اختار نوع العيب»');
  is(calls('register_defect').length === 0, 'تسجيل ناقص: صفر نداء');
  await fillForm(page);
  await page.fill('#fNotes', 'شق في الجنب');
  await page.dblclick('#submitBtn');                                    // ضغطتين ورا بعض
  await page.waitForSelector('#sumOverlay.open');
  is(calls('register_defect').length === 1, 'ضغطتين على «تسجيل» = نداء واحد (الزرار اتقفل)');
  const body = calls('register_defect')[0].body;
  is(body.employee === 'Test_Emp' && body.variantId === VARIANT.variantId && body.defectTypeId === 1 && body.repairable === true && body.side === 'right' && body.origin === 'new' && body.stockMode === 'deduct' && body.notes === 'شق في الجنب', 'جسم الطلب: كل الحقول');
  is(/^[0-9a-f-]{36}$/.test(body.requestId), 'requestId = UUID');
  const sum = await page.locator('#sumBody').innerText();
  is(sum.includes('تم') && sum.includes('خصم 1 من المخزون'), 'ملخص: بادج «تم» + «ما تم فعليًا»');
  await page.click('#sumFtr .btn-ghost');
  is(!(await visible(page, '#prodWrap')), 'بعد النجاح: النموذج اتفضّى');
  is((await page.locator('#sessList').innerText()).includes('GT1 / White / 41'), 'اتسجّل في الجلسة دي');
  is(await page.evaluate(() => document.activeElement.id) === 'entryInput', 'الفوكس رجع للمربع');
  is(errs.length === 0, 'صفر أخطاء كونسول', errs.join(' | '));
  await ctx.close();
}
{ // المهلة/الشبكة → إعادة بنفس requestId
  const { page, ctx } = await openPage();
  await pickProduct(page); await fillForm(page);
  S.mode = 'lost';
  await page.click('#submitBtn'); await page.waitForSelector('#sumOverlay.open #sumRetry');
  is((await page.locator('#sumBody').innerText()).includes('تم جزئيًا'), 'شبكة واقعة: ملخص أصفر «تم جزئيًا» مش «فشل»');
  is((await page.locator('#sumBody').innerText()).includes('مش هتخصم مرتين'), 'الرسالة بتقول إن الإعادة آمنة');
  const first = calls('register_defect')[0].body.requestId;
  S.mode = 'ok'; await page.click('#sumRetry'); await page.waitForSelector('#sumOverlay.open');
  await page.waitForFunction(() => document.getElementById('sumBody').innerText.includes('تم'));
  const regs = calls('register_defect');
  is(regs.length === 2 && regs[1].body.requestId === first, 'الإعادة بنفس requestId بالظبط');
  is(await page.locator('#prodWrap').isHidden(), 'بعد نجاح الإعادة: النموذج اتفضّى');
  await ctx.close();
}
{ // الرصيد 0
  const { page, ctx } = await openPage();
  S.zero = true; await pickProduct(page); await fillForm(page);
  await page.click('#submitBtn'); await page.waitForSelector('#cfmOverlay.open');
  const t = await page.locator('#cfmBody').innerText();
  is(t.includes('الرصيد') && t.includes('بدون خصم'), 'الرصيد 0: نافذة قرار بالأثر');
  is(await page.locator('#cfmCancel').innerText() === 'إلغاء' && /بدون خصم/.test(await page.locator('#cfmOk').innerText()), 'الاختيارين: إلغاء / تسجيل بدون خصم');
  await page.click('#cfmCancel');
  is(calls('register_defect').length === 1 && (await visible(page, '#prodWrap')), 'إلغاء: المنتج والنموذج زي ما هم، ومفيش نداء تاني');
  await page.click('#submitBtn'); await page.waitForSelector('#cfmOverlay.open');
  await page.click('#cfmOk'); await page.waitForSelector('#sumOverlay.open');
  const regs = calls('register_defect');
  is(regs.length === 3 && regs[2].body.stockMode === 'skip' && regs[2].body.requestId === regs[0].body.requestId, 'تسجيل بدون خصم: stockMode=skip بنفس requestId');
  await ctx.close();
}
{ // الصور
  const { page, ctx } = await openPage();
  await pickProduct(page); await fillForm(page);
  await page.setInputFiles('#filePick', [{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: JPEG }]);
  is(await page.locator('#thumbs .thumb').count() === 1, 'صورة JPEG: ظهرت كمصغّرة');
  await page.setInputFiles('#filePick', [{ name: 'x.heic', mimeType: 'image/heic', buffer: JPEG }]);
  is(await page.locator('#thumbs .thumb').count() === 1 && /HEIC/.test(await page.locator('#toastContainer').innerText()), 'HEIC: مرفوض برسالة واضحة');
  await page.setInputFiles('#filePick', [{ name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>' + ' '.repeat(40)) }]);
  is(await page.locator('#thumbs .thumb').count() === 1, 'SVG: مرفوض');
  await page.setInputFiles('#filePick', [{ name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(15 * 1024 * 1024 + 1, 1) }]);
  is(await page.locator('#thumbs .thumb').count() === 1, 'أكبر من 15MB: مرفوض');
  is(await page.locator('#fileCam').getAttribute('capture') === 'environment' && (await page.locator('#filePick').getAttribute('capture')) === null, 'زرّين: كاميرا (capture) وملف (من غير capture)');
  await page.click('#thumbs .thumb button'); is(await page.locator('#thumbs .thumb').count() === 0, 'شيل مصغّرة');
  await page.setInputFiles('#filePick', [{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: JPEG }, { name: 'b.jpg', mimeType: 'image/jpeg', buffer: JPEG }]);
  await page.click('#submitBtn'); await page.waitForSelector('#sumOverlay.open');
  await page.waitForFunction(() => document.getElementById('sumBody').innerText.includes('الصور'));
  const ups = calls('add_defect_image');
  is(ups.length === 2, 'اترفعت صورتين بالتسلسل', String(ups.length));
  is(ups.every(u => /^multipart\/form-data; boundary=/.test(u.headers['content-type'])), 'الرفع multipart بـ boundary من المتصفح (مفيش Content-Type يدوي)');
  is(ups.every(u => u.headers.authorization === `Bearer ${SECRET}`), 'الرفع بهيدر Authorization');
  is(ups[0].raw.includes('name="defectId"') && ups[0].raw.includes('name="file"') && ups[0].raw.includes('name="employee"'), 'حقول الرفع: employee · defectId · file');
  is((await page.locator('#sumBody').innerText()).includes('اترفع 2 من 2'), 'ملخص الصور');
  await ctx.close();
}
{ // نوع عيب جديد
  const { page, ctx } = await openPage();
  await pickProduct(page);
  await page.selectOption('#fType', '__new'); is(await visible(page, '#newTypeBox'), 'اختيار «إضافة نوع جديد» بيفتح الحقل');
  await page.fill('#newTypeInput', 'لون باهت'); await page.press('#newTypeInput', 'Enter'); await page.waitForTimeout(300);
  is(calls('add_defect_type').length === 1 && (await page.inputValue('#fType')) === '2', 'النوع الجديد اتضاف واتحدد');
  is(await page.locator('#fType option', { hasText: 'لون باهت' }).count() === 1, 'ظهر في القايمة');
  await ctx.close();
}

// ═════════ ④ المخزن الرقمي ═════════
console.log('\n④ المخزن الرقمي');
{
  const { page, ctx, errs } = await openPage();
  await page.click('#mainTabRegistry'); await page.waitForSelector('#regBody tr[data-id]');
  is(await page.locator('#regBody tr[data-id]').count() === 3, 'تحميل ٣ صفوف');
  is((await page.locator('#regCount').innerText()) === '3', 'عدد النتائج من get_defects_count');
  const g = calls('get_defects')[0];
  is(g.params.limit === '50' && g.params.offset === '0', 'pagination من السيرفر (٥٠)');
  is(await page.locator('#regTbl thead th').count() === 14, '١٤ عمود');
  is(await page.locator('#regTbl thead th .th-flt').count() >= 9, 'أيقونة قمع على كل عمود قابل للفلترة');
  is((await page.locator('#regBody tr[data-id="1"]').innerText()).includes('📅') && (await page.locator('#regBody tr[data-id="1"]').innerText()).includes('🕐'), 'التاريخ والوقت عمودين بصيغة 📅 / 🕐');
  is(await page.locator('#regClearAll.inactive').count() === 1, '«مسح كل الفلاتر» خامل بلا فلتر');
  is(!(await visible(page, '#regChipsZone')), 'منطقة الشيبس مخفية بلا فلتر');
  // فلتر الحالة
  await page.click('#rthStatus .th-flt'); await page.waitForSelector('.srv-pop.open');
  await page.click('.srv-pop.open .srv-item:has-text("قابل للإصلاح")'); await page.waitForTimeout(150);
  is(await page.locator('.srv-pop.open').count() === 1, 'القايمة بتفضل مفتوحة بعد أول اختيار (#32)');
  await page.click('.srv-pop.open .srv-item:has-text("اتصلح")'); await page.waitForTimeout(500);
  const f = calls('get_defects').at(-1);
  is(f.params.statuses === 'awaiting_repair,repaired' || f.params.statuses === 'repaired,awaiting_repair', 'الفلتر اتبعت للسيرفر كقايمة CSV', f.params.statuses);
  is(calls('get_defects_count').at(-1).params.statuses === f.params.statuses, 'العدّ بنفس الفلاتر');
  is(await visible(page, '#regChipsZone') && (await page.locator('#regChips .chips-label').innerText()).includes('الحالة'), 'شيبس سطر لكل فلتر باسمه مرة');
  is(await page.locator('#regClearAll.inactive').count() === 0, '«مسح كل الفلاتر» اتفعّل');
  await page.keyboard.press('Escape');
  await page.click('#regClearAll'); await page.waitForTimeout(500);
  is(!calls('get_defects').at(-1).params.statuses, 'مسح كل الفلاتر: اتشال من الطلب');
  // ترتيب 3 حالات
  const sku = '.th-label[data-sort-key="sku"]';
  await page.click(sku); await page.waitForTimeout(150);
  is(calls('get_defects').at(-1).params.sortBy === 'sku' && calls('get_defects').at(-1).params.sortDir === 'asc', 'ترتيب ١: تصاعدي');
  is(await page.locator('#regTbl th.sorted .sort-icon').innerText() === '▲', 'أيقونة الترتيب ظاهرة بس عند التفعيل');
  await page.click(sku); await page.waitForTimeout(150);
  is(calls('get_defects').at(-1).params.sortDir === 'desc', 'ترتيب ٢: تنازلي');
  await page.click(sku); await page.waitForTimeout(150);
  is(!calls('get_defects').at(-1).params.sortBy && await page.locator('#regTbl th.sorted').count() === 0, 'ترتيب ٣: بلا ترتيب');
  // إجراءات الصف
  const r1 = '#regBody tr[data-id="1"]';
  is(await page.locator(`${r1} [data-act="repaired"]`).count() === 1 && await page.locator(`${r1} [data-act="cancel"]`).count() === 1, 'قابل للإصلاح: اتصلحت · غير قابلة · إلغاء');
  is(await page.locator('#regBody tr[data-id="3"] button[data-act]:not([data-act="images"])').count() === 0, 'اتصلح: مفيش إجراءات (نهائي)');
  await page.click(`${r1} [data-act="repaired"]`); await page.waitForSelector('#cfmOverlay.open');
  is((await page.locator('#cfmBody').innerText()).includes('هيتضاف 1 للستوك') && (await page.locator('#cfmBody').innerText()).includes('نهائية'), 'تأكيد «اتصلحت» بيسمّي الأثر بالأرقام');
  await page.click('#cfmCancel'); is(calls('set_status').length === 0, 'إلغاء التأكيد: صفر نداء');
  await page.click(`${r1} [data-act="repaired"]`); await page.waitForSelector('#cfmOverlay.open'); await page.click('#cfmOk'); await page.waitForTimeout(400);
  const ss = calls('set_status');
  is(ss.length === 1 && ss[0].body.status === 'repaired' && ss[0].body.defectId === 1 && ss[0].body.employee === 'Test_Emp', 'اتصلحت: set_status بالحقول الصح');
  is((await page.locator(r1).innerText()).includes('اتصلح') && await page.locator(`${r1} button[data-act]:not([data-act="images"])`).count() === 0, 'الصف اتحدّث ونُزع سلاحه (مفيش إجراءات تاني)');
  // غير قابل للإصلاح ↔ قابل (بدون تأكيد)
  const r2 = '#regBody tr[data-id="2"]';
  await page.click(`${r2} [data-act="awaiting"]`); await page.waitForTimeout(300);
  is(calls('set_status').at(-1).body.status === 'awaiting_repair' && !(await visible(page, '#cfmOverlay.open')), 'رجوع لقابل للإصلاح: بدون تأكيد');
  // إلغاء
  await page.click(`${r2} [data-act="cancel"]`); await page.waitForSelector('#cfmOverlay.open');
  is((await page.locator('#cfmBody').innerText()).includes('هيرجع 1 للستوك'), 'تأكيد الإلغاء بالأثر');
  await page.click('#cfmOk'); await page.waitForTimeout(300);
  is(calls('cancel_defect').length === 1, 'إلغاء: cancel_defect');
  is(errs.length === 0, 'صفر أخطاء كونسول', errs.join(' | '));
  await ctx.close();
}
{ // الصور: Lazy
  const { page, ctx } = await openPage();
  await page.click('#mainTabRegistry'); await page.waitForSelector('#regBody tr[data-id]');
  is(calls('get_image').length === 0, 'الصور مابتتحملش مع الجدول (Lazy)');
  await page.click('#regBody tr[data-id="1"] [data-act="images"]'); await page.waitForSelector('#imgOverlay.open .img-row');
  is(await page.locator('#imgList .img-row').count() === 2 && calls('get_image').length === 0, 'قايمة بيانات الصور بس، مفيش صورة اتحمّلت');
  await page.click('#imgList .img-row:first-child button:has-text("عرض")'); await page.waitForSelector('#imgView img');
  const gi = calls('get_image')[0];
  is(gi && gi.params.id === '11' && gi.headers.authorization === `Bearer ${SECRET}`, 'عرض: get_image بهيدر Authorization');
  is((await page.locator('#imgView img').getAttribute('src')).startsWith('blob:'), 'الصورة blob URL');
  await page.click('#imgList .img-row:last-child button:has-text("عرض")'); await page.waitForTimeout(300);
  is(await page.evaluate(() => window.__revoked) >= 1, 'تبديل الصورة: revokeObjectURL على القديمة');
  const before = await page.evaluate(() => window.__revoked);
  await page.click('#imgOverlay .eco-modal-ftr .btn-ghost');
  is(await page.evaluate(() => window.__revoked) > before, 'الإغلاق: revokeObjectURL');
  // إضافة صورة من النافذة
  await page.click('#regBody tr[data-id="1"] [data-act="images"]'); await page.waitForSelector('#imgOverlay.open .img-row');
  await page.setInputFiles('#mPick', [{ name: 'c.jpg', mimeType: 'image/jpeg', buffer: JPEG }]); await page.waitForTimeout(500);
  is(calls('add_defect_image').length === 1 && calls('add_defect_image')[0].raw.includes('name="defectId"'), 'إضافة صورة من نافذة الصور');
  await ctx.close();
}

// ═════════ ⑤ سجل العمليات والتصدير ═════════
console.log('\n⑤ سجل العمليات');
{
  const { page, ctx, errs } = await openPage();
  await page.click('#mainTabLog'); await page.waitForSelector('#logBody tr:not(.empty-row)');
  is(await page.locator('#logBody tr').count() === 2, 'صفين في السجل');
  is((await page.locator('#logBody tr').first().innerText()).includes('تم'), 'عمود النتيجة من extra.result');
  is((await page.locator('#logBody tr').nth(1).innerText()).includes('—'), 'صف قديم بلا result بيتعرض «—» مش «✓»');
  is(calls('get_logs_count').length === 1, 'العدّ من get_logs_count');
  // تصدير مقصوص
  S.truncate = true; await page.click('#logTabContent button:has-text("تصدير")'); await page.waitForSelector('#logExportWarn:not([hidden])');
  const w = await page.locator('#logExportWarn').innerText();
  is(w.includes('اتقص') && w.includes('5,000'), 'التصدير المقصوص: بانر ثابت بالرقمين');
  is(!/تم تصدير/.test(await page.locator('#toastContainer').innerText()), 'مفيش «تم تصدير ✓» على ملف ناقص');
  S.truncate = false; await page.click('#logTabContent button:has-text("تصدير")'); await page.waitForTimeout(300);
  is(!(await visible(page, '#logExportWarn')) && /تم تصدير 2 عملية/.test(await page.locator('#toastContainer').innerText()), 'تصدير كامل: بانر مخفي + توست نجاح');
  is((await page.evaluate(() => window.__xl.length)) >= 2, 'ExcelJS اتنادى بالصفوف');
  // تصدير المخزن الرقمي
  await page.click('#mainTabRegistry'); await page.waitForSelector('#regBody tr[data-id]');
  S.truncate = true; await page.click('#registryTabContent button:has-text("تصدير")'); await page.waitForSelector('#regExportWarn:not([hidden])');
  is((await page.locator('#regExportWarn').innerText()).includes('اتقص'), 'تصدير المخزن الرقمي المقصوص: بانر');
  is(errs.length === 0, 'صفر أخطاء كونسول', errs.join(' | '));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${fail ? '❌' : '✅'} النتيجة: ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
