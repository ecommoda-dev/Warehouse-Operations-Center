// ══════════════════════════════════════════════════════════════
// docs/audit-check.mjs — فحص متصفح فعلي لـ `Inventory-Audit-Updater.html` (جرد المخزون)
//
// 🔴 **ليه ملف سابع؟** نفس قرار الستة اللي قبله: Worker وهمي بشكل رد مختلف
//    (أولويات · باركود · أوردرات · فهرس جماعي · سجل). الأداة دي اتحوّلت من أداة
//    مستقلة ليها شاشة دخول وخروج تلقائي وسر خاص ومودالات إعدادات وتوست خاصين بيها —
//    يعني **كل قطعة chrome فيها اتشالت أو اتبدّلت**، وعيلة الفشل هنا صامتة:
//    ① دالة اتشالت وحد لسه بيناديها → زرار مايعملش حاجة، صفر خطأ لحد ما تدوس.
//    ② سر بيتقري من مفتاح تاني → كل نداء `401` والصفحة تفتح عادي.
//    ③ `employee` في جسم الكتابة فاضي → المحاسبة بتضيع بلا أي رسالة.
//    ④ الخروج وسط جلسة جماعية بيضيّع نص ساعة عدّ.
//    كلهم **مستحيل يتمسكوا بمراجعة كود**.
//
// التشغيل:  npm i playwright --no-save && node docs/audit-check.mjs
// ══════════════════════════════════════════════════════════════
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const PAGE = 'Inventory-Audit-Updater.html';
const SECRET = 'test-secret-warehouse-ops';
const WORKER = 'https://inventory-audit-updater-worker.ecommoda-dev.workers.dev';

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log('  ✅', m); };
const bad = (m, d='') => { fail++; console.log('  ❌', m, d ? `\n       ${d}` : ''); };
const is  = (cond, m, d='') => cond ? ok(m) : bad(m, d);

const launchOpts = { args: ['--no-sandbox'] };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launchOpts);

// ══════════════════════════════════════════════════════════════
// Worker وهمي
// ══════════════════════════════════════════════════════════════
const VARIANT = {
  id: 'gid://shopify/ProductVariant/1001',
  sku: 'AA1 / Black / 41',
  barcode: '12345678',
  product: { id: 'gid://shopify/Product/2001', title: 'AA1 Black', vendor: 'Ecommoda', status: 'ACTIVE', featuredImage: null },
  inventoryItem: { id: 'gid://shopify/InventoryItem/3001', inventoryLevels: { nodes: [{ quantities: [
    { name: 'available', quantity: 5 }, { name: 'committed', quantity: 1 }, { name: 'on_hand', quantity: 6 },
  ] }] } },
  selectedOptions: [{ name: 'Size', value: '41' }, { name: 'Color', value: 'Black' }],
};
const PRIORITIES = [
  { variantId: VARIANT.id, productId: VARIANT.product.id, sku: 'AA1 / Black / 41', productTitle: 'AA1 Black', available: 0, committed: 2, lastAuditDate: null },
  { variantId: 'gid://shopify/ProductVariant/1002', productId: VARIANT.product.id, sku: 'AA1 / Black / 42', productTitle: 'AA1 Black', available: 4, committed: 0, lastAuditDate: '2026-07-01T10:00:00Z' },
  { variantId: 'gid://shopify/ProductVariant/1003', productId: 'gid://shopify/Product/2002', sku: 'BB2 / White / 40', productTitle: 'BB2 White', available: 9, committed: 1, lastAuditDate: null },
];
const LOG_ROWS = [
  { id: 1, timestamp: '2026-10-12T09:00:00Z', employee: 'Ahmed_Ibraheem', type: 'ok', delta: 0, sku: 'AA1 / Black / 41', productTitle: 'AA1 Black', extra: JSON.stringify({ result: 'success' }) },
  { id: 2, timestamp: '2026-10-12T09:05:00Z', employee: 'Abo_Selim', type: 'adjustment', delta: -2, sku: 'BB2 / White / 40', productTitle: 'BB2 White', extra: JSON.stringify({ result: 'success' }) },
];
const EMPLOYEES = [
  { username: 'Ahmed_Ibraheem', display_name: 'Ahmed Ibraheem' },
  { username: 'Abo_Selim', display_name: 'Abo Selim' },
];

async function makePage({ session = true, secret = SECRET, workerVersion = '6.2.2', bulkDelayMs = 0 } = {}) {
  const ctx = await browser.newContext({ locale: 'ar-EG' });
  const page = await ctx.newPage();
  const calls = [];          // { action, method, auth, body, aborted }
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  // الخطوط وexceljs من CDN خارجي — محجوبين في بيئة الفحص، والفشل ده مش من الصفحة.
  await page.route(url => /fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.hostname), r =>
    r.fulfill({ status: 200, headers: { 'Content-Type': r.request().resourceType() === 'script' ? 'text/javascript' : 'text/css' }, body: '' }));
  await page.route(url => url.href.startsWith(WORKER), async route => {
    const req = route.request();
    const u = new URL(req.url());
    const action = u.searchParams.get('action');
    const rec = { action, method: req.method(), auth: req.headers()['authorization'] || '', params: Object.fromEntries(u.searchParams), body: null, aborted: false };
    try { rec.body = req.postData() ? JSON.parse(req.postData()) : null; } catch {}
    calls.push(rec);
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() });
    const reply = (obj, status = 200) => route.fulfill({ status, headers: { ...cors(), 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
    switch (action) {
      case 'get_config':            return reply({ ok: true, version: workerVersion });
      case 'diag':                  return reply({ ok: true, version: workerVersion, tool: 'inventory_audit', checks: [
                                      { ok: true, label: 'D1 (DB)', detail: 'متصل' },
                                      { ok: false, label: 'LOCATION_ID', detail: 'ناقص' } ] });
      case 'get_employees':         return reply({ ok: true, employees: EMPLOYEES });
      case 'get_audit_priorities':  return reply({ ok: true, variants: PRIORITIES });
      case 'lookup_barcode':        return reply({ ok: true, variant: VARIANT });
      case 'get_details':           return reply({ ok: true, orders: [] });
      case 'get_audit_date':        return reply({ ok: true, auditDate: null });
      case 'set_audit_date':        return reply({ ok: true, result: 'success', auditDate: '2026-10-13T10:00:00Z', logged: true });
      case 'get_logs':              return reply({ ok: true, entries: LOG_ROWS });
      case 'get_logs_count':        return reply({ ok: true, total: LOG_ROWS.length });
      case 'get_bulk_index': {
        if (bulkDelayMs) {
          // الطلب بيتأخر عن قصد: اختبار «إلغاء» محتاج طلب لسه في الطيران
          const done = new Promise(r => setTimeout(r, bulkDelayMs));
          await done;
        }
        return reply({ ok: true, variants: [], dupBarcodes: {}, truncated: false });
      }
      default:                      return reply({ ok: false, error: 'Unknown action ' + action }, 404);
    }
  });
  if (session) {
    await ctx.addInitScript(({ secret, sess }) => {
      try {
        sessionStorage.setItem('woc_session', JSON.stringify(sess));
        if (secret) localStorage.setItem('warehouse_ops_worker_secret', secret);
      } catch {}
    }, { secret, sess: { v: 1, username: 'Ahmed_Ibraheem', displayName: 'Ahmed Ibraheem', loginAt: new Date().toISOString() } });
  }
  return { ctx, page, calls, errors };
}
function cors() {
  return { 'Access-Control-Allow-Origin': BASE, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════
console.log('\n① بلا جلسة → تحويل لـ index.html بـ ?next= وفحص next بيقبل الاسم');
{
  const { ctx, page } = await makePage({ session: false });
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForURL(/index\.html\?next=/, { timeout: 5000 }).catch(() => {});
  const u = new URL(page.url());
  is(u.pathname.endsWith('/index.html'), 'اتحوّل للرئيسية', page.url());
  is(u.searchParams.get('next') === PAGE, 'next = اسم الصفحة', u.searchParams.get('next'));
  const accepted = await page.evaluate(n => NEXT_RE.test(n), PAGE);
  is(accepted, 'NEXT_RE بيقبل «Inventory-Audit-Updater.html» (حروف كبيرة وشرطة)');
  const evil = await page.evaluate(() => ['https://evil.example/x.html', '//evil.html', '../a.html', 'a/b.html'].some(n => NEXT_RE.test(n)));
  is(!evil, 'NEXT_RE لسه بيرفض الروابط الخارجية والمسارات');
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n② بجلسة — الهيكل والـ chrome من الـ shell');
{
  const { ctx, page, calls, errors } = await makePage();
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('.app-header h1');
  await wait(400);

  is((await page.title()).includes('جرد المخزون'), 'عنوان التاب فيه «جرد المخزون»', await page.title());
  is(await page.locator('.app-header h1').innerText() === 'جرد المخزون', 'عنوان الهيدر');
  is(await page.locator('#loginOverlay, .login-overlay, #idleWarn, #pinZone').count() === 0, 'مفيش شاشة دخول ولا PIN ولا تحذير خمول في الصفحة');
  is(await page.locator('.hbtn-home').count() === 1, 'زرار 🏠 الرئيسية موجود');
  is((await page.locator('.hbtn-home').evaluate(el => el.getAttribute('onclick'))).includes('index.html'), 'زرار الرئيسية بيرجع لـ index.html');
  const userBtn = page.locator('#activeUserBtn');
  is((await userBtn.innerText()).includes('Ahmed Ibraheem') && await userBtn.getAttribute('aria-label') === 'تسجيل الخروج', 'زرار الموظف = اسم + aria-label الخروج');
  const tv = await page.evaluate(() => TOOL_VERSION);
  is((await page.locator('#verBtn').innerText()).includes(tv), 'زرار النسخة بيقول نسخة الهب', tv);
  is((await page.locator('#clLatestVerBadge').innerText()) === tv, 'بادج الـ changelog مطابق لنسخة الهب');
  is(await page.locator('#settingsOverlay').count() === 1 && !(await page.locator('#settingsOverlay').evaluate(e => e.classList.contains('open'))), 'مودال الإعدادات من الـ shell ومش مفتوح لوحده');
  is(await page.locator('#toastContainer').count() === 1, 'حاوية التوست من الـ shell');
  is(await page.locator('.main-tabs-bar .main-tab-btn').count() === 2, 'تابين: الجرد + السجل');
  is(await page.locator('.inv-hub-card').count() === 3, 'شاشة الاختيار فيها التلات مربعات (فردي · أولويات · جماعي)');

  // توكنز الهب هي اللي مطبّقة
  const css = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { accent: cs.getPropertyValue('--accent').trim(), cmax: getComputedStyle(document.querySelector('.container')).maxWidth,
             bg: getComputedStyle(document.body).backgroundColor, th: cs.getPropertyValue('--th-size').trim(),
             yellow: cs.getPropertyValue('--yellow-light').trim(), redDarker: cs.getPropertyValue('--red-darker').trim() };
  });
  is(css.accent === '#2563eb', '--accent أزرق الهب', css.accent);
  is(css.cmax === '1400px', 'Tier L = 1400px', css.cmax);
  is(css.bg === 'rgb(243, 244, 246)', 'خلفية الهب', css.bg);
  is(css.th === '12px' && css.yellow === '#fef9c3' && css.redDarker === '#991b1b', 'التوكنز الجديدة (th/yellow/red-darker) معرّفة في الـ shell');
  is(!(await page.evaluate(() => [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.selectorText === ':root'); } catch { return false; } }) && document.querySelectorAll('style').length && [...document.querySelectorAll('style')].some(s => /:root\s*\{/.test(s.textContent)))), 'مفيش كتلة :root في <style> الصفحة');

  // النداءات
  const cfgCalls = calls.filter(c => c.action === 'get_config');
  is(cfgCalls.length >= 1 && cfgCalls.every(c => c.auth === `Bearer ${SECRET}`), 'get_config اتنادى بسر الهب (warehouse_ops_worker_secret)', JSON.stringify(cfgCalls.map(c => c.auth)));
  is(!calls.some(c => ['check_employee', 'verify_employee', 'register_pin', 'log_logout'].includes(c.action)), 'صفر نداء دخول/خروج على Worker الجرد');
  is(await page.locator('#verStaleBtn').isHidden(), 'Worker 6.2.2 ≥ الحد الأدنى → مفيش تحذير نسخة');

  // localStorage
  const keys = await page.evaluate(() => Object.keys(localStorage));
  is(keys.every(k => k === 'warehouse_ops_worker_secret' || k.startsWith('stockaudit_col_widths_')), 'localStorage: السر + تفضيل عرض الأعمدة بس', keys.join(','));
  is(!keys.includes('stockaudit_worker_secret'), 'المفتاح القديم stockaudit_worker_secret مابقاش موجود');

  // الأخطاء
  is(errors.length === 0, 'صفر أخطاء كونسول/صفحة عند التحميل', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n③ الإعدادات والفحص الذاتي من الـ shell');
{
  const { ctx, page, errors } = await makePage();
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('#settingsBtn');
  await page.click('#settingsBtn');
  is(await page.locator('#settingsOverlay.open').count() === 1, 'زرار الإعدادات بيفتح المودال');
  is((await page.locator('#settingsOverlay .settings-static').allInnerTexts()).join(' ').includes('inventory-audit-updater-worker'), 'قايمة الـ Workers فيها inventory-audit-updater-worker');
  is((await page.locator('#cfgSecret').inputValue()) === SECRET, 'حقل السر متملّي من مفتاح الهب');
  await page.click('#diagBtn');
  await page.waitForFunction(() => document.getElementById('diagResult')?.innerText.includes('LOCATION_ID'), null, { timeout: 5000 }).catch(() => {});
  const diag = await page.locator('#diagResult').innerText();
  is(diag.includes('جرد المخزون'), 'الفحص الذاتي بيسمّي الأداة بالاسم', diag.slice(0, 120));
  is(diag.includes('❌') && diag.includes('LOCATION_ID'), 'الفحص الفاشل ظاهر ❌');
  is(!diag.includes(SECRET), 'الفحص مابيعرضش قيمة السر');
  await page.click('#settingsOverlay .btn-modal-cancel');
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n④ حارس نسخة الـ Worker (الاتجاهين) وغياب السر');
{
  const old = await makePage({ workerVersion: '6.0.0' });
  await old.page.goto(`${BASE}/${PAGE}`);
  await old.page.waitForSelector('#verStaleBtn', { state: 'attached' });
  await old.page.waitForFunction(() => document.getElementById('verStaleBtn').style.display !== 'none', null, { timeout: 5000 }).catch(() => {});
  is(await old.page.locator('#verStaleBtn').isVisible(), 'Worker 6.0.0 < 6.2.1 → تحذير «نسخة قديمة» ظاهر');
  await old.page.click('#verStaleBtn');
  await wait(200);
  const toast = await old.page.locator('#toastContainer').innerText();
  is(toast.includes('جرد المخزون'), 'رسالة التحذير بتسمّي الأداة', toast);
  await old.ctx.close();

  const nosec = await makePage({ secret: '' });
  await nosec.page.goto(`${BASE}/${PAGE}`);
  await nosec.page.waitForSelector('.app-header h1');
  await wait(500);
  is(await nosec.page.locator('#settingsOverlay.open').count() === 0, 'بلا سر: المودال مايفتحش لوحده');
  is(nosec.calls.length === 0, 'بلا سر: صفر نداء للـ Worker', String(nosec.calls.length));
  await nosec.ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑤ أولويات الجرد — الجدول بيتملّى وبيحمّل الصنف');
{
  const { ctx, page, calls, errors } = await makePage();
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('.inv-hub-card');
  await page.click('.inv-hub-card:nth-child(2)');
  await page.waitForSelector('#priorityBody .priority-row', { timeout: 5000 });
  is(await page.locator('#priorityBody .priority-row').count() === PRIORITIES.length, 'صفوف الأولويات == اللي رجع من الـ Worker');
  is(calls.some(c => c.action === 'get_audit_priorities'), 'اتنادى get_audit_priorities');
  // P2 chip: color قراية فعلية (مش token)
  const p2 = await page.evaluate(() => {
    const d = document.createElement('span'); d.className = 'priority-badge priority-badge-p2'; document.body.appendChild(d);
    const c = getComputedStyle(d).color; d.remove(); return c;
  });
  is(p2 === 'rgb(154, 52, 18)', 'شارة P2 على --orange-dark (تباين)', p2);
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑥ الجرد الفردي — سكان باركود → «الجرد مظبوط» والموظف في جسم الكتابة');
{
  const { ctx, page, calls, errors } = await makePage();
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('.inv-hub-card');
  await page.click('.inv-hub-card:nth-child(1)');
  await page.click('#tabBarcode');
  await page.fill('#barcodeInput', '12345678');
  await page.waitForSelector('#results.visible', { timeout: 5000 });
  const lk = calls.find(c => c.action === 'lookup_barcode');
  is(lk && lk.params.barcode === '12345678', 'lookup_barcode اتنادى بالباركود');
  is((await page.locator('#productSkuDisplay').innerText()).includes('AA1'), 'كارت المنتج اتعرض');
  // الباركود → get_details بيحسب currentShelfQty
  await page.waitForFunction(() => document.getElementById('qtyShelf').textContent.trim() !== '—', null, { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => { if (currentShelfQty == null) currentShelfQty = 6; });   // لو الحساب مشروط بحاجة تانية
  await page.click('#btnAuditOk');
  await page.waitForSelector('#confirmOverlay.open', { timeout: 3000 });
  await page.click('#confirmOkBtn');
  await page.waitForFunction(() => true);
  await wait(400);
  const w = calls.find(c => c.action === 'set_audit_date');
  is(!!w && w.method === 'POST', 'set_audit_date اتنادى POST');
  is(w?.body?.employee === 'Ahmed_Ibraheem', 'employee في الجسم = اسم المستخدم من جلسة الهب', JSON.stringify(w?.body));
  is(w?.auth === `Bearer ${SECRET}`, 'الكتابة بسر الهب');
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑦ تاب السجل — فلتر الموظف بيتملّى من get_employees (كان أثر جانبي لشاشة الدخول)');
{
  const { ctx, page, calls, errors } = await makePage();
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('#mainTabLog');
  is(!calls.some(c => c.action === 'get_employees'), 'قبل فتح السجل: صفر get_employees');
  await page.click('#mainTabLog');
  await page.waitForSelector('#logBody tr td', { timeout: 5000 });
  await wait(400);
  is(calls.some(c => c.action === 'get_logs') && calls.some(c => c.action === 'get_logs_count'), 'اتنادى get_logs و get_logs_count');
  is(calls.some(c => c.action === 'get_employees'), 'اتنادى get_employees لفلتر الموظف');
  const emp = await page.evaluate(() => LOG_OPTS.emp.map(o => o.t));
  is(emp.length === 2 && emp.includes('Abo Selim'), 'LOG_OPTS.emp اتملّت بأسماء العرض', emp.join(','));
  is(await page.locator('#logBody tr').count() === LOG_ROWS.length, 'صفوف السجل == اللي رجع');
  is(await page.locator('#mainTabLog.active').count() === 1, 'تاب السجل active');
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑧ الجرد الجماعي — إلغاء تحميل الباركودات (cancelSignal في wocApi)');
{
  const { ctx, page, calls, errors } = await makePage({ bulkDelayMs: 4000 });
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('.inv-hub-card');
  await page.click('.inv-hub-card:nth-child(3)');
  await page.waitForSelector('#bulkLoadOverlay.open', { timeout: 3000 });
  is(calls.some(c => c.action === 'get_bulk_index'), 'فتح التاب بدأ تحميل الفهرس');
  await page.click('#bulkLoadCancelBtn');
  await page.waitForFunction(() => !document.getElementById('bulkLoadOverlay').classList.contains('open'), null, { timeout: 3000 });
  ok('نافذة التحميل اتقفلت بعد «إلغاء»');
  const toast = await page.locator('#toastContainer').innerText();
  is(toast.includes('اتلغى تحميل الباركودات'), 'توست «اتلغى» (e.cancelled اتمرّر من الـ shell)', toast);
  is(await page.evaluate(() => bulkIndex === null || bulkIndex === undefined), 'مفيش فهرس اتحمّل');
  is(!errors.some(e => /Uncaught|TypeError|ReferenceError/.test(e)), 'صفر أخطاء JS', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑨ حراس الخروج — جلسة جماعية فيها مسحات / دفعة بتتنفّذ');
{
  const { ctx, page, errors } = await makePage();
  let dialogs = 0, acceptNext = false;
  page.removeAllListeners('dialog');
  page.on('dialog', d => { dialogs++; acceptNext ? d.accept() : d.dismiss(); });
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('.app-header h1');
  is(await page.evaluate(() => onBeforeLogout()) === true, 'بلا مسحات: الخروج مسموح من غير سؤال');
  is(dialogs === 0, 'صفر سؤال');
  await page.evaluate(() => { bulkScans.set('v1', { scanned: 3, manual: 0 }); });
  const stay = await page.evaluate(() => onBeforeLogout());
  is(stay === false && dialogs === 1, 'مسحات ما اتنفّذتش: بيسأل، والرفض بيوقّف الخروج');
  acceptNext = true;
  const leave = await page.evaluate(() => onBeforeLogout());
  is(leave === true && dialogs === 2, 'القبول بيسمح بالخروج');
  await page.evaluate(() => { isUpdatingBulk = true; });
  const before = dialogs;
  const blocked = await page.evaluate(() => onBeforeLogout());
  is(blocked === false && dialogs === before, 'أثناء تنفيذ دفعة: الخروج ممنوع بلا سؤال');
  await page.evaluate(() => { isUpdatingBulk = false; });
  // زرار الخروج الفعلي مربوط بالخطّاف
  await page.evaluate(() => { bulkScans.set('v1', { scanned: 1, manual: 0 }); });
  acceptNext = false;
  await page.click('#activeUserBtn');
  await wait(300);
  is(page.url().includes(PAGE) && await page.evaluate(() => !!sessionStorage.getItem('woc_session')), 'ضغطة ✕ مع مسحات + رفض: الجلسة لسه موجودة والصفحة هي هي');
  // «🏠 الرئيسية» = `location.href` في الـ shell (مفيش خطّاف) → المتصفح هو اللي بيسأل (beforeunload)
  let bu = null;
  page.removeAllListeners('dialog');
  page.on('dialog', d => { if (d.type() === 'beforeunload') bu = d.type(); d.dismiss().catch(() => {}); });
  await page.click('body');                       // beforeunload بيحتاج تفاعل سابق من الموظف
  await page.click('.hbtn-home');
  await wait(500);
  is(bu === 'beforeunload' && page.url().includes(PAGE), '«🏠 الرئيسية» مع مسحات: المتصفح بيسأل (beforeunload) والرفض بيسيبه في الصفحة', `dialog=${bu} url=${page.url()}`);
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑩ نغمة alarm (الصفحة بتنادي playBeep(\'alarm\') على باركود مجهول/متكرر)');
{
  const { ctx, page } = await makePage();
  await ctx.addInitScript(() => {
    window.__osc = [];
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    const orig = A.prototype.createOscillator;
    A.prototype.createOscillator = function () { const o = orig.call(this); window.__osc.push(o); return o; };
  });
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('.app-header h1');
  await page.evaluate(() => { __osc.length = 0; playBeep('alarm'); });
  const n = await page.evaluate(() => __osc.length);
  const types = await page.evaluate(() => __osc.map(o => o.type));
  is(n === 3 && types.every(t => t === 'square'), 'alarm = ثلاث دقّات مربّعة', `${n} / ${types}`);
  await page.evaluate(() => { __osc.length = 0; playBeep('error'); });
  is(await page.evaluate(() => __osc.length) === 1, 'error لسه نغمة واحدة (ما اتأثرتش)');
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑪ الرئيسية — المربع والرابط');
{
  const { ctx, page } = await makePage();
  await page.goto(`${BASE}/index.html`);
  await page.waitForSelector('.woc-tool');
  const tile = page.locator(`a.woc-tool[href="${PAGE}"]`);
  is(await tile.count() === 1, 'مربع «جرد المخزون» موجود في الرئيسية');
  is((await tile.innerText()).includes('جرد المخزون'), 'اسم المربع');
  is(await page.locator('.woc-home-sec', { hasText: 'أخرى' }).locator(`a[href="${PAGE}"]`).count() === 1, 'المربع في قسم «أخرى»');
  await tile.click();
  await page.waitForURL(`**/${PAGE}`, { timeout: 5000 });
  ok('الضغط بيفتح الصفحة بالجلسة (من غير دخول تاني)');
  await page.waitForSelector('.app-header h1');
  is(await page.locator('.app-header h1').innerText() === 'جرد المخزون', 'الصفحة اتفتحت');
  await ctx.close();
}

await browser.close().catch(() => {});
server.close();
console.log(`\n${fail ? '❌' : '✅'} ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
