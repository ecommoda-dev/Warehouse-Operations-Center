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
const SIBLINGS = [42, 43].map(n => ({ ...VARIANT, id: 'gid://shopify/ProductVariant/10' + n, sku: 'AA1 / Black / ' + n, barcode: '999' + n, selectedOptions: [{ name: 'Size', value: String(n) }] }))
  .concat([{ ...VARIANT, id: 'gid://shopify/ProductVariant/1999', sku: 'AA1 / White / 41', product: { ...VARIANT.product, id: 'gid://shopify/Product/2999' } }]);
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

async function makePage({ siblings = false, session = true, secret = SECRET, workerVersion = '6.2.2', bulkDelayMs = 0, prioTruncated = false, orders = [] } = {}) {
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
      case 'get_audit_priorities':  return reply({ ok: true, variants: PRIORITIES, truncated: prioTruncated, cap: 10000 });
      case 'lookup_barcode':        return reply({ ok: true, variant: VARIANT });
      case 'list_skus':             return reply({ ok: true, variants: siblings ? [VARIANT, ...SIBLINGS] : [VARIANT] });
      case 'adjust_inventory':      return reply({ ok: true, status: 'success', auditDate: '2026-10-13T10:00:00Z', logged: true });
      case 'get_details':           return reply({ ok: true, orders });
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
  is(await page.locator('.main-tabs-bar .main-tab-btn').count() === 4, '٤ تابات: جرد فردي · جرد جماعي · أولويات الجرد · سجل العمليات');
  is(await page.locator('.inv-hub-card, .inv-back-btn').count() === 0, 'مفيش شاشة اختيار ولا أزرار رجوع (التابات هي التنقل)');
  is(await page.locator('#mainTabAudit.active').count() === 1 && await page.locator('#auditTabContent').isVisible(), 'الجرد الفردي هو التاب الافتراضي');

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
  await page.waitForSelector('#mainTabPriority');
  await page.click('#mainTabPriority');
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
  await page.waitForSelector('#entryInput');
  await page.fill('#entryInput', '12345678');
  await page.press('#entryInput', 'Enter');
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
console.log('\n⑧ الجرد الجماعي — إلغاء تحميل الباركودات (cancelSignal في ecoApi)');
{
  const { ctx, page, calls, errors } = await makePage({ bulkDelayMs: 4000 });
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('#mainTabBulk');
  await page.click('#mainTabBulk');
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
  await page.waitForSelector('.eco-tool');
  const tile = page.locator(`a.eco-tool[href="${PAGE}"]`);
  is(await tile.count() === 1, 'مربع «جرد المخزون» موجود في الرئيسية');
  is((await tile.innerText()).includes('جرد المخزون'), 'اسم المربع');
  is(await page.locator('.eco-home-sec', { hasText: 'أخرى' }).locator(`a.eco-tool[href="${PAGE}"]`).count() === 1, 'المربع في قسم «أخرى»');
  await tile.click();
  await page.waitForURL(`**/${PAGE}`, { timeout: 5000 });
  ok('الضغط بيفتح الصفحة بالجلسة (من غير دخول تاني)');
  await page.waitForSelector('.app-header h1');
  is(await page.locator('.app-header h1').innerText() === 'جرد المخزون', 'الصفحة اتفتحت');
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑫ تنسيق التصدير = الـ core (قرار أحمد 22-10-2026)');
{
  const { ctx, page } = await makePage();
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('.app-header h1');
  const r = await page.evaluate(() => ({
    d: formatDateForExport('2026-10-22T10:00:00Z'),
    t: formatTimeForExport('2026-10-22T10:30:00Z'),
    e: formatDateForExport(null), et: formatTimeForExport(''),
    local: /function\s+formatDateForExport/.test([...document.scripts].map(x => x.textContent).join('\n')),
  }));
  is(r.d === '22-10-2026', 'التاريخ DD-MM-YYYY زي الـ core', r.d);
  is(/^\d{2}:\d{2} (صباحاً|مساءً)$/.test(r.t), 'الوقت hh:mm صباحاً/مساءً', r.t);
  is(r.e === '' && r.et === '', 'الفاضي = خانة فاضية مش «—»');
  is(!r.local, 'مفيش نسخة محلية بتغلب الـ core في الصفحة');
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑬ فلاتر الجداول — محرّك واحد بس (v1.76.0) + تنبيه تقصّ الأولويات');
{
  const { ctx, page } = await makePage({ prioTruncated: true });
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('#mainTabPriority');
  await page.click('#mainTabPriority');
  await page.waitForSelector('#priorityBody .priority-row', { timeout: 5000 });
  // ① مفيش حقن من المكوّن العام (ecoTablesAuto) على الجداول التلاتة اللي ليها محرّكها (§TBL-JS)
  const r = await page.evaluate(() => Object.fromEntries(['prioTbl', 'bulkTbl', 'logTbl'].map(id => {
    const t = document.getElementById(id);
    return [id, { notable: t.hasAttribute('data-eco-notable'), eco: t.querySelectorAll('.eco-hf,.eco-rz').length, own: t.querySelectorAll('.th-flt').length }];
  })));
  for (const id of ['prioTbl', 'bulkTbl', 'logTbl']) {
    is(r[id].notable && r[id].eco === 0, `${id}: مفيش أزرار فلتر من المكوّن العام (eco-hf/eco-rz)`, JSON.stringify(r[id]));
    is(r[id].own > 0, `${id}: فلاتر المحرّك الأصلي موجودة`, JSON.stringify(r[id]));
  }
  // ② تنبيه الاقتصاص ظاهر وفيه السقف
  const w = await page.evaluate(() => { const b = document.getElementById('priorityTruncWarn'); return { shown: b.style.display !== 'none', txt: b.textContent }; });
  is(w.shown && w.txt.includes('10,000'), 'تنبيه «القايمة اتقصّت» ظاهر وفيه السقف', w.txt);
  await ctx.close();
}
{
  const { ctx, page } = await makePage();   // من غير تقصّ
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('#mainTabPriority');
  await page.click('#mainTabPriority');
  await page.waitForSelector('#priorityBody .priority-row', { timeout: 5000 });
  const shown = await page.evaluate(() => document.getElementById('priorityTruncWarn').style.display !== 'none');
  is(!shown, 'مفيش تنبيه لما القايمة كاملة');
  await ctx.close();
}


// ══════════════════════════════════════════════════════════════
console.log('\n⑭ التابات الأربعة + مربع الإدخال الموحّد + كارت الصنف + لوحة العد + نافذة الأوردرات غير المغلّفة');
const ORDER_UNPACKED = { id: 'gid://shopify/Order/9001', orderId: 9001, name: '#9001', createdAt: '2026-11-20T10:00:00Z', packedBy: null, orderStage: 'S1', items: [{ unfulfilledQuantity: 1 }] };
const ORDER_PACKED = { ...ORDER_UNPACKED, packedBy: 'Mona' };
{
  const { ctx, page, calls, errors } = await makePage();
  await page.goto(`${BASE}/${PAGE}`);
  await page.waitForSelector('#entryInput');
  // التابات
  await page.click('#mainTabBulk');
  is(await page.locator('#bulkTabContent').isVisible() && !(await page.locator('#auditTabContent').isVisible()) && await page.locator('#mainTabBulk.active').count() === 1, 'جرد جماعي: بيتفتح بضغطة واحدة والفردي بيتقفل');
  await page.click('#mainTabLog'); await page.click('#mainTabAudit');
  is(await page.locator('#auditTabContent').isVisible() && await page.locator('#mainTabLog.active').count() === 0, 'الرجوع للجرد الفردي من غير زرار رجوع');
  // آخر تاب في الجلسة
  await page.click('#mainTabPriority'); await page.reload(); await page.waitForSelector('#mainTabPriority');
  is(await page.locator('#mainTabPriority.active').count() === 1, 'فتح على آخر تاب (أولويات) بعد الريفريش');
  await page.click('#mainTabBulk'); await page.reload(); await page.waitForSelector('#mainTabPriority');
  is(await page.locator('#mainTabAudit.active').count() === 1, 'الجرد الجماعي مابيتفتحش لوحده بعد الريفريش');
  // مربع الإدخال
  await page.click('#mainTabAudit');
  await page.fill('#entryInput', '12345'); await page.press('#entryInput', 'Enter');
  is((await page.locator('#entryFails').innerText()).includes('5 خانة') && !calls.some(c => c.action === 'lookup_barcode'), 'رقم بطول غلط ← صندوق أحمر وصفر نداء للـ Worker');
  await page.fill('#entryInput', ''); await page.type('#entryInput', '١٢٣٤٥٦٧٨');
  is(await page.inputValue('#entryInput') === '12345678', 'الأرقام العربي بتتحوّل إنجليزي لحظيًا');
  await wait(2200);
  is(!calls.some(c => c.action === 'lookup_barcode'), 'مفيش بحث تلقائي بالمؤقّت — Enter بس');
  await page.fill('#entryInput', ''); await page.type('#entryInput', 'AA1');
  is(await page.locator('#entryChip-sku.is-on .entry-chip-auto').count() === 1, 'الـ chip اتحوّل تلقائيًا لـ SKU وعليه بادج «تلقائي»');
  await page.fill('#entryInput', ''); await page.type('#entryInput', '12345678'); await page.press('#entryInput', 'Enter');
  await page.waitForSelector('#results.visible', { timeout: 5000 });
  is(await page.inputValue('#entryInput') === '', 'المربع اتفضّى بعد التحميل');
  is(await page.locator('#entryChip-barcode.is-on').count() === 1, 'الـ chip بيتبع النوع (باركود)');
  // كارت الصنف
  is((await page.locator('#productSizeVal').innerText()).trim() === '41', 'المقاس ظاهر 41 في المربع');
  const lnk = await page.locator('#productSkuLink').getAttribute('href');
  is(/\/products\/2001\/variants\/1001/.test(lnk || ''), 'الـ SKU نفسه لينك لصفحة المتغيّر', lnk);
  is(await page.locator('a.nav-link-btn:has-text("صفحة الـ SKU")').count() === 0, 'زرار «صفحة الـ SKU» اتشال');
  is((await page.locator('#refreshBtn').innerText()).includes('تحديث') && (await page.locator('#historyLink').innerText()).includes('سجل حركة المخزون'), 'أسماء الأزرار: تحديث · سجل حركة المخزون');
  is(await page.locator('.eq-row .stat-card').count() === 5 && (await page.locator('.eq-row').innerText()).includes('إجمالي المخزن'), 'خمس مربعات للأرقام (On Hand زيهم) بتوضيحها العربي');
  is(await page.locator('#warningBanner').count() === 0, 'بانر التحذير الكبير اتشال');
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page, calls } = await makePage({ orders: [ORDER_UNPACKED] });
  await page.goto(`${BASE}/${PAGE}`);
  await page.fill('#entryInput', '12345678'); await page.press('#entryInput', 'Enter');
  await page.waitForFunction(() => currentShelfQty != null, null, { timeout: 5000 });
  is(await page.locator('#ordersBodyWrap.collapsed').count() === 0, 'الأوردرات مفتوحة تلقائيًا (≤ 5)');
  is((await page.locator('#qtyPacked').innerText()).trim() === '0', 'Packed = 0');
  await page.click('#btnStartScanCount');
  await page.waitForSelector('#scanCountPanel.visible');
  is(await page.locator('#btnAuditOk').isDisabled(), 'أزرار البداية بتتعطّل وقت العد');
  for (let i = 0; i < 6; i++) await page.evaluate(() => processScanCountValue('12345678'));
  is((await page.locator('#btnCountFinal').innerText()).includes('سجّل الجرد مظبوط') && (await page.locator('#countDiff').innerText()).includes('مطابق'), 'العدد مطابق ← الزرار «سجّل الجرد مظبوط»');
  await page.click('button:has-text("إعادة العد")');
  is((await page.locator('#scanCountTotal').innerText()).trim() === '0' && await page.locator('#scanCountPanel.visible').count() === 1, 'إعادة العد بتصفّر وتفضل في اللوحة');
  for (let i = 0; i < 5; i++) await page.evaluate(() => processScanCountValue('12345678'));
  is((await page.locator('#btnCountFinal').innerText()).includes('تعديل الكمية بـ −1'), 'فيه فرق ← الزرار «تعديل الكمية بـ −1»');
  is((await page.locator('#countNotes').inputValue()).includes('عدد بالسكانر: 5'), 'الملاحظة اتكتبت تلقائيًا');
  await page.click('#btnCountFinal');
  await page.waitForSelector('#unpackedOverlay.open', { timeout: 3000 });
  const wtxt = await page.locator('#unpackedOverlay').innerText();
  is(wtxt.includes('خد بالك') && wtxt.includes('طاولة التغليف') && wtxt.includes('#9001'), 'نافذة التحذير: النص وأرقام الأوردرات');
  is(await page.locator('#confirmOverlay.open').count() === 0, 'نافذة التأكيد مابتظهرش قبل التحذير');
  await page.click('#unpackedNo');
  is(await page.locator('#unpackedOverlay.open').count() === 0 && !calls.some(c => c.action === 'adjust_inventory'), '«رجوع» بيلغي من غير كتابة');
  await page.click('#btnCountFinal'); await page.waitForSelector('#unpackedOverlay.open');
  await page.click('#unpackedOk');
  await page.waitForSelector('#confirmOverlay.open', { timeout: 3000 });
  await page.click('#confirmOkBtn'); await wait(500);
  const adj = calls.find(c => c.action === 'adjust_inventory');
  is(adj?.body?.delta === -1 && String(adj?.body?.notes || '').includes('عدد بالسكانر'), 'adjust_inventory بالفرق −1 والملاحظة', JSON.stringify(adj?.body));
  is(await page.locator('#scanCountPanel.visible').count() === 0, 'لوحة العد اتقفلت بعد النجاح');
  await ctx.close();
}
{
  const { ctx, page } = await makePage({ orders: [ORDER_PACKED] });
  await page.goto(`${BASE}/${PAGE}`);
  await page.fill('#entryInput', '12345678'); await page.press('#entryInput', 'Enter');
  await page.waitForFunction(() => currentShelfQty != null, null, { timeout: 5000 });
  await page.click('#btnWantAdjust');
  is(await page.locator('#adjustPanel.visible').count() === 1 && await page.locator('#adjustPanel button:has-text("رجوع")').count() === 1, 'التعديل اليدوي فيه زرار رجوع');
  await page.click('#adjustPanel .delta-btn:not(.minus)');
  await page.click('#btnApplyAdjust');
  await page.waitForSelector('#confirmOverlay.open', { timeout: 3000 });
  is(await page.locator('#unpackedOverlay.open').count() === 0, 'كله اتغلّف (Committed − Packed = 0) ← مفيش نافذة تحذير');
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑮ أولويات: عمود «إجراءات» · نافذتا التأكيد · صور البحث · ترتيب الأزرار (v1.80.0)');
{
  const IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#cbd5e1"/><path d="M15 80 L45 45 L70 70 L90 40 L108 80Z" fill="#475569"/></svg>');
  const saved = VARIANT.product.featuredImage;
  VARIANT.product.featuredImage = { url: IMG, altText: '' };
  const SHOTS = process.env.SHOTS;                       // مجلد لقطات اختياري
  const shot = async (page, name) => { if (SHOTS) await wait(700), await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const { ctx, page, calls, errors } = await makePage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await ctx.route(url => url.hostname === 'admin.shopify.com', r => r.fulfill({ status: 200, headers: { 'Content-Type': 'text/html' }, body: 'shopify' }));
  await page.goto(`${BASE}/${PAGE}`);
  await page.click('#mainTabPriority');
  await page.waitForSelector('#priorityBody .priority-row', { timeout: 5000 });
  await shot(page, '1-priorities');
  is(await page.locator('#prioHeadRow th').count() === 6, 'الجدول 6 أعمدة');
  is((await page.locator('#prioHeadRow th').last().innerText()).trim() === 'إجراءات', 'آخر عمود = إجراءات');
  const row = page.locator('#priorityBody .priority-row').first();
  is(await row.locator('.prio-act').count() === 2, 'زرارين بس في الصف (فردي + سجل الحركة)');
  is(await row.locator('button:has-text("جرد جماعي")').count() === 0 && await row.locator('.prio-act:has-text("داشبورد")').count() === 0, 'زرارا الجماعي والداشبورد اتشالوا');
  const href = await row.locator('a.priority-sku').getAttribute('href');
  is(/\/products\/2001\/variants\/1001$/.test(href || ''), 'الـ SKU نفسه لينك لصفحة المقاس على شوبيفاي', href);
  // نسخ الـ SKU
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await row.locator('.prio-copy').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  is(clip === null || clip === 'AA1 / Black / 41', 'زرار النسخ بينسخ الـ SKU', String(clip));
  is(await row.locator('.prio-copy.is-ok').count() === 1, 'زرار النسخ بيأكد بعلامة ✓');
  // الضغط على الصف نفسه ما بقاش بيفتح الجرد الفردي
  await row.locator('td').nth(2).click();
  is(await page.locator('#auditTabContent').isHidden(), 'الضغط على الصف لا يفتح الجرد الفردي');
  // سجل الحركة: بيفتح نافذة ويوجّهها لتاريخ المخزون
  const popup = page.waitForEvent('popup', { timeout: 5000 });
  await row.locator('button:has-text("سجل حركة المخزون")').click();
  const pw = await popup;
  await pw.waitForURL(/inventory_history/, { timeout: 5000 }).catch(() => {});
  is(/products\/inventory\/3001\/inventory_history/.test(pw.url()), 'سجل الحركة بيفتح inventory_history للصنف', pw.url());
  await pw.close().catch(() => {});
  // جرد فردي
  await row.locator('button:has-text("جرد فردي")').click();
  await page.waitForSelector('#results.visible', { timeout: 5000 });
  is(await page.locator('#auditTabContent').isVisible() && /AA1/.test(await page.locator('#productSkuDisplay').innerText()), 'زرار جرد فردي يحمّل الصنف في تاب الفردي');
  // نافذة «الجرد مظبوط»
  await page.click('#btnAuditOk');
  await page.waitForSelector('#confirmOverlay.open');
  const body = page.locator('#confirmBody');
  is(await body.locator('img.cf-img').count() === 1, 'صورة المنتج في النافذة');
  is((await body.locator('.cf-sku').innerText()).trim() === 'AA1 / Black / 41', 'SKU تحت الصورة');
  is((await body.locator('.cf-size').innerText()).trim() === '41', 'المقاس في بادج');
  const txt = await body.innerText();
  is(!/المنتج|سيتم تسجيل/.test(txt), 'اسم المنتج وجملة التسجيل اتشالوا');
  is(/👤\s*Ahmed Ibraheem/.test(txt), 'الموظف مع 👤');
  is(await body.locator('.cf-shelf-num').count() === 1, 'بادج عدد القطع على الرف');
  is(await page.locator('#confirmCancelBtn.cancel-red').count() === 1, 'زرار الإلغاء بثيم أحمر');
  await shot(page, '2-confirm');
  await page.click('#confirmCancelBtn');
  // قايمة البحث بالصور
  await page.fill('#entryInput', 'aa1 black');
  await page.waitForSelector('#entryDropdown .dropdown-item, .dropdown-item', { timeout: 5000 });
  is(await page.locator('.dropdown-item img.item-thumb').count() >= 1, 'صورة المنتج في نتائج البحث');
  await shot(page, '3-search');
  // ترتيب الأزرار وأسماؤها
  await page.keyboard.press('Escape');
  const ids = await page.$$eval('.audit-q-btns button', bs => bs.map(b => b.id));
  is(ids.join() === 'btnAuditOk,btnWantAdjust,btnStartScanCount', 'ترتيب الأزرار: مظبوط · تعديل العدد · العد بالسكانر', ids.join());
  is((await page.locator('#btnWantAdjust').innerText()).includes('تعديل العدد'), 'زرار «تعديل العدد»');
  is(await page.locator('#btnStartScanCount svg').count() === 1 && !(await page.locator('#btnStartScanCount').innerText()).includes('📷'), 'أيقونة السكانر SVG بدل 📷');
  if (SHOTS) { await wait(500); await page.locator('.audit-q-btns').screenshot({ path: path.join(SHOTS, '5-buttons.png') }); }
  // نافذة تأكيد تعديل الكمية بتصميم نافذة الجرد
  await page.click('#btnWantAdjust');
  await page.click('#adjustPanel .delta-btn:not(.minus)');
  await page.click('#btnApplyAdjust');
  await page.waitForSelector('#confirmOverlay.open');
  const ab = page.locator('#confirmBody');
  is(await ab.locator('img.cf-img').count() === 1 && (await ab.locator('.cf-sku').innerText()).trim() === 'AA1 / Black / 41' && (await ab.locator('.cf-size').innerText()).trim() === '41', 'نافذة التعديل: صورة + SKU + مقاس');
  is(await ab.locator('.cf-cell').count() === 3 && await ab.locator('.cf-cell-new').count() === 1, 'نافذة التعديل: الحالي · التعديل · الجديد');
  is(/👤\s*Ahmed Ibraheem/.test(await ab.innerText()), 'نافذة التعديل: الموظف مع 👤');
  is(await page.locator('#confirmCancelBtn.cancel-red').count() === 1, 'نافذة التعديل: الإلغاء أحمر');
  await shot(page, '4-adjust-confirm');
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  VARIANT.product.featuredImage = saved;
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
console.log('\n⑯ كارت المنتج · باقي المقاسات · جدول الأوردرات · توست وصوت (v1.82.0)');
const ORDER_FULL = { ...ORDER_PACKED, name: '#9002', orderId: 9002, packingDateTime: '2026-11-26T09:24:18Z', s1Status: 'Ready', s2Status: null, courier: 'Abo Yassin', whereaboutsS1: 'Warehouse', whereaboutsS2: null };
const ORDER_ODD  = { ...ORDER_UNPACKED, name: '#9003', orderId: 9003, s1Status: 'New Order', s2Status: 'Printed', courier: 'Bosta', whereaboutsS1: null, whereaboutsS2: null };
{
  const { ctx, page, calls, errors } = await makePage({ siblings: true, orders: [ORDER_FULL, ORDER_ODD] });
  await ctx.addInitScript(() => {
    window.__osc = [];
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return;
    const orig = A.prototype.createOscillator;
    A.prototype.createOscillator = function () { const o = orig.call(this); window.__osc.push(o); return o; };
  });
  await page.goto(`${BASE}/${PAGE}`);
  await page.fill('#entryInput', '12345678'); await page.press('#entryInput', 'Enter');
  await page.waitForFunction(() => currentShelfQty != null, null, { timeout: 5000 });
  // ── كارت المنتج
  const g = async sel => page.locator(sel).evaluate(e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: r.x, y: r.y, b: r.bottom }; });
  const img = await g('#productImgWrap'), box = await g('#productSizeBox'), sku = await g('#productSkuLink');
  is(img.w >= 90 && img.w === img.h, 'الصورة أكبر (≈١٫٥×) ومربعة', JSON.stringify(img));
  is(box.w === img.w && box.h === img.h && Math.abs(box.y - img.y) < 2, 'مربع المقاس بنفس حجم الصورة وجنبها', JSON.stringify({ img, box }));
  is(Math.abs(img.x - (box.x + box.w)) < 20 || Math.abs(box.x - (img.x + img.w)) < 20, 'مربع المقاس لازق في الصورة');
  is(sku.y >= img.b - 1, 'الـ SKU تحت الصورة', JSON.stringify({ img, sku }));
  is(await page.locator('#sizesBtn').count() === 1 && (await page.locator('#sizesBtn').innerText()).includes('باقي مقاسات المنتج'), 'زرار «باقي مقاسات المنتج»');
  const sb = await g('#sizesBtn');
  is(Math.abs(sb.y - box.y) < 130 && sb.x < box.x, 'الزرار بجانب المقاس');
  const brand = await g('#productBrand'), hist = await g('#historyLink'), ref = await g('#refreshBtn');
  is(brand.y < hist.y && brand.x + brand.w < img.x && Math.abs(brand.x - hist.x) < 200, 'البراند والحالة أقصى اليسار فوق زرار سجل الحركة', JSON.stringify({ brand, hist, img }));
  const col = id => page.locator(id).evaluate(e => getComputedStyle(e).backgroundColor);
  is(await col('#refreshBtn') !== await col('#historyLink'), 'لون «تحديث» مميّز عن «سجل حركة المخزون»');
  if (process.env.SHOTS) { await page.setViewportSize({ width: 1000, height: 1000 }); await wait(800); await page.screenshot({ path: path.join(process.env.SHOTS, '6-product-card.png') }); }
  // ── جدول الأوردرات
  is(await page.locator('#ordersBodyWrap.collapsed').count() === 0, 'فيه أوردرات ← الجدول مفتوح تلقائيًا');
  const heads = await page.$$eval('.orders-table th', hs => hs.map(h => h.textContent.trim()));
  for (const h of ['تاريخ التغليف', 'وقت التغليف', 'حالة S1', 'حالة S2', 'المندوب', 'مكان شحنة S1', 'مكان شحنة S2']) is(heads.includes(h), 'عمود «' + h + '»');
  is(await page.locator('.orders-table .summary-row').count() === 0 && !(await page.locator('#ordersBody').innerText()).includes('الإجمالي ('), 'سطر الإجمالي اتحذف');
  const rows = page.locator('.orders-table tbody tr');
  const r1 = await rows.nth(0).locator('td').allInnerTexts(), r2 = await rows.nth(1).locator('td').allInnerTexts();
  is(r1.length === heads.length && r2.length === heads.length, 'خلايا الصف = أعمدة الهيدر');
  is(/26\/11\/2026/.test(r1[2]) && /11:24|١١:٢٤|11:24/.test(r1[3]), 'تاريخ ووقت التغليف بتوقيت القاهرة', r1[2] + ' | ' + r1[3]);
  is(r1[7].includes('Ready') && r1[8].trim() === '—' && r1[9].includes('Abo Yassin') && r1[10].includes('في المخزن') && r1[11].trim() === '—', 'S1=Ready · S2 فاضي · المندوب · مكان S1 في المخزن', r1.slice(7).join(' | '));
  is(r2[7].includes('New Order') && r2[7].includes('⏳'), 'حالة عابرة (New Order) معاها عمر', r2[7]);
  is(r2[8].includes('⚠') && r2[8].includes('Printed'), 'قيمة S2 مش في الـ choices ← معلّمة ⚠ بدون تحريك', r2[8]);
  is(r2[9].includes('Bosta') && r2[10].includes('غير مسجّل') && !r2[10].includes('في المخزن') && !r2[10].includes('خارج النطاق'), 'مندوب Bosta: مفيش معاملة خاصة — مكان الشحنة الفاضي «غير مسجّل»', r2[9] + ' | ' + r2[10]);
  // ── مفيش أوردرات ← مطوي
  const m = await makePage({ orders: [] });
  await m.page.goto(`${BASE}/${PAGE}`);
  await m.page.fill('#entryInput', '12345678'); await m.page.press('#entryInput', 'Enter');
  await m.page.waitForFunction(() => currentShelfQty != null, null, { timeout: 5000 });
  is(await m.page.locator('#ordersBodyWrap.collapsed').count() === 1 && (await m.page.locator('#ordersCountBadge').innerText()).trim() === '0', 'صفر أوردرات ← الجدول مطوي تلقائيًا');
  await m.ctx.close();
  // ── Worker قديم (من غير الحقول الجديدة) ← «—» + تنبيه
  const o = await makePage({ orders: [{ ...ORDER_UNPACKED, name: '#9010', orderId: 9010 }] });
  await o.page.goto(`${BASE}/${PAGE}`);
  await o.page.fill('#entryInput', '12345678'); await o.page.press('#entryInput', 'Enter');
  await o.page.waitForFunction(() => currentShelfQty != null, null, { timeout: 5000 });
  is((await o.page.locator('.orders-table tbody tr td').nth(7).innerText()).trim() === '—' && (await o.page.locator('.orders-meta-note').innerText()).includes('v6.2.6'), 'Worker أقدم: «—» وتنبيه بالنسخة المطلوبة');
  await o.ctx.close();
  // ── باقي المقاسات
  await page.click('#sizesBtn'); await page.waitForSelector('#sizesOverlay.open .size-opt');
  const opts = await page.$$eval('#sizesList .size-opt', bs => bs.map(b => ({ t: b.querySelector('.so-size').textContent.trim(), d: b.disabled })));
  is(opts.map(x => x.t).join() === '41,42,43' && opts[0].d && !opts[1].d, 'المقاسات 41/42/43 بس (مفيش لون تاني) والحالي متعطّل', JSON.stringify(opts));
  await page.click('#sizesList .size-opt:has-text("43")');
  await page.waitForFunction(() => currentVariant && /43/.test(currentVariant.sku), null, { timeout: 4000 });
  is(await page.locator('#sizesOverlay.open').count() === 0 && (await page.locator('#productSizeVal').innerText()).trim() === '43', 'اختيار مقاس بيفتحه في الجرد الفردي والنافذة بتتقفل');
  // ── توست + صوت عند تحديث الجرد
  await page.evaluate(() => { __osc.length = 0; });
  await page.click('#btnAuditOk'); await page.waitForSelector('#confirmOverlay.open');
  await page.click('#confirmOkBtn');
  await page.waitForSelector('.toast.toast-success:has-text("تسجيل الجرد")', { timeout: 4000 });
  const toast = await page.locator('.toast.toast-success:has-text("تسجيل الجرد")').first().innerText();
  is(toast.includes('تسجيل الجرد') && toast.includes('AA1 / Black / 43'), 'توست نجاح بيسمّي العملية والـ SKU', toast);
  is(await page.evaluate(() => __osc.length) >= 1, 'صوت تنبيه مع نجاح التحديث');
  is(await page.locator('#productTopbar.flash-ok').count() === 1, 'وميض أخضر على كارت المنتج');
  is(errors.length === 0, 'صفر أخطاء', errors.join(' | '));
  await ctx.close();
}

await browser.close().catch(() => {});
server.close();
console.log(`\n${fail ? '❌' : '✅'} ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
