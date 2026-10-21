// ══════════════════════════════════════════════════════════════
// docs/home-check.mjs — فحص متصفح فعلي للشاشة الرئيسية (`index.html`)
//
// 🔴 **ليه ملف سادس؟** نفس قرار الخمسة اللي قبله: Worker وهمي بشكل رد مختلف.
//    وعيلة الفشل هنا **صامتة بالكامل**:
//    ① «النهارده» بتفقد الأوردرات اللي بعد الساعة ٩ مساءً (يوم UTC بدل يوم
//      القاهرة) — الرقم بيبان طبيعي وهو ناقص.
//    ② إعادة الطباعة بتتحسب مرتين → الرقم بيتنفخ.
//    ③ فشل جلب «خلص» بيخفي الطابور (أو بيتعرض صفر) — «تعذّر» ≠ «مفيش شغل».
//    ④ سجل أطول من الحد بيعدّي كرقم ناقص كأنه كامل.
//    مستحيل يتمسكوا بمراجعة كود — بيتمسكوا بتشغيل الصفحة فعلاً.
//
// التشغيل:  npm i playwright --no-save && node docs/home-check.mjs
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

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log('  ✅', m); };
const bad = (m, d='') => { fail++; console.log('  ❌', m, d ? `\n       ${d}` : ''); };
const is  = (cond, m, d='') => cond ? ok(m) : bad(m, d);

const launchOpts = { args: ['--no-sandbox'] };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launchOpts);

// ── أيام القاهرة — بـ`Intl` على Africa/Cairo (نفس نهج `toCairo` في الـ shell) ──
// 🔴 كانت إزاحة +٣ ثابتة والـ fixtures بساعات UTC مكتوبة على الصيفي: بعد ٢٩-١٠-٢٠٢٦ (UTC+2)
//    «١٢:٣٠ ص القاهرة» بتبقى ٢٢:٣٠Z مش ٢١:٣٠Z والفحص كان هيفشل لسبب مالوش علاقة بالكود.
const pad = n => String(n).padStart(2, '0');
const _fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const offsetMs = t => { const o = {}; for (const p of _fmt.formatToParts(new Date(t))) if (p.type !== 'literal') o[p.type] = p.value;
  return Date.UTC(+o.year, +o.month - 1, +o.day, o.hour === '24' ? 0 : +o.hour, +o.minute, +o.second) - Math.floor(t / 1000) * 1000; };
const dayOf = ms => { const d = new Date(ms + offsetMs(ms)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; };
// لحظة UTC (ISO) لساعة محددة بتوقيت القاهرة في يوم `YYYY-MM-DD`
const cairoIso = (day, h, m) => { const g = Date.parse(`${day}T00:00:00Z`); const start = g - offsetMs(g - offsetMs(g));
  return new Date(start + (h * 60 + m) * 60000).toISOString(); };
const addDays = (s, n) => { const [y,m,d] = s.split('-').map(Number); const x = new Date(Date.UTC(y, m-1, d) + n*86400000); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`; };
const TODAY = dayOf(Date.now()), YEST = addDays(TODAY, -1), D2 = addDays(TODAY, -2);

// 🔴 الفخ: الساعة ١٢:٣٠ بعد منتصف الليل بتوقيت القاهرة = ٢١:٣٠ **من يوم UTC اللي قبله**.
const T_TODAY_MORNING = cairoIso(TODAY, 10, 0);          // النهارده ١٠:٠٠ القاهرة
const T_TODAY_UTCTRAP = cairoIso(TODAY, 0, 30);           // النهارده ١٢:٣٠ ص القاهرة (يوم UTC = امبارح!)
const T_YEST_LATE     = cairoIso(YEST, 23, 30);           // امبارح ١١:٣٠ م
const T_YEST_NOON     = cairoIso(YEST, 12, 0);           // امبارح ١٢:٠٠ ظهرًا
const T_D2_LATE       = cairoIso(D2, 23, 30);             // أول إمبارح ١١:٣٠ م — **مش** داخل

const E = (timestamp, type, order, extra) => ({ timestamp, type, order_name: `#${order}`, extra: extra === undefined ? null : JSON.stringify(extra) });

// الطباعة: الإعادة (#100 مرتين النهارده) بتتحسب مرة · not_found و error مش «اتطبع» · #106 النهارده بحكم القاهرة
const PRINT_LOGS = [
  E(T_TODAY_MORNING, 'S1', 100, { result: { status: 'success' } }),
  E(T_TODAY_MORNING, 'S1', 100, { result: { status: 'success' } }),      // إعادة طباعة
  E(T_TODAY_MORNING, 'S2', 101, { result: { status: 'warning' } }),
  E(T_TODAY_MORNING, 'AWB', 102),
  E(T_TODAY_MORNING, 'not_found', 103),                                  // ❌ ما اتطبعش
  E(T_TODAY_MORNING, 'S1', 104, { result: { status: 'error' } }),        // ❌ فشل
  E(T_TODAY_MORNING, 'S1', 105, { result: { status: 'success' } }),
  E(T_TODAY_UTCTRAP, 'AWB', 106),                                        // ✅ النهارده (يوم UTC = امبارح)
  E(T_YEST_LATE, 'S1', 100, { result: { status: 'success' } }),          // نفس الأوردر امبارح كمان
  E(T_YEST_LATE, 'S1', 200),
  E(T_YEST_NOON, 'S2', 201),
  E(T_D2_LATE, 'S1', 300),                                               // ❌ خارج الفترة
];
const PACK_LOGS = [
  E(T_TODAY_MORNING, 'packed', 400, { result: 'success' }),
  E(T_TODAY_MORNING, 'packed', 400, { result: 'success' }),              // إعادة تغليف
  E(T_TODAY_MORNING, 'packed', 401, { result: 'warning' }),
  E(T_TODAY_MORNING, 'login', 0),                                        // ❌ مش تغليف
  E(T_YEST_NOON, 'packed', 402),
];
const SHIP_LOGS = [
  E(T_TODAY_MORNING, 'update', 500, { result: 'success' }),
  E(T_TODAY_MORNING, 'update', 501, { result: 'warning' }),
  E(T_TODAY_MORNING, 'update', 502, { result: 'already' }),              // ❌ خلاص متعمل
  E(T_TODAY_MORNING, 'rejected', 503, { result: 'rejected' }),           // ❌ رفض
  E(T_TODAY_UTCTRAP, 'update', 504, { result: 'success' }),              // ✅ النهارده بحكم القاهرة
  E(T_YEST_NOON, 'update', 505, { result: 'success' }),
];
const EXPECT = { print: [5, 3], pack: [2, 1], ship: [3, 1] };           // [النهارده, امبارح]

// ══════════════════════════════════════════════════════════════
// Worker وهمي — السيناريو بيتغيّر من `mode`
// ══════════════════════════════════════════════════════════════
function makeStub(mode = {}) {
  const calls = { logs: [], orders: 0 };
  const stub = async (route) => {
    const url = new URL(route.request().url());
    const host = url.hostname, action = url.searchParams.get('action');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });

    if (action === 'get_config') return json({ ok: true, version: '99.0.0' });

    // طابور الطباعة — `/orders` (path مش action)
    if (host.startsWith('order-printer-worker') && url.pathname === '/orders') {
      calls.orders++;
      if (mode.printQueueFail) return json({ ok: false, error: 'boom' }, 500);
      const only = mode.pendingOnly;     // كل بوسطة معلّقة (بلا تاج رفع) → خانة بوسطة صفر + بادج
      const orders = only
        ? [{ channel: 'awb', zone: 'Other_Regions', tags: [] }, { channel: 'awb', zone: 'Other_Regions', tags: [] }]
        : [
            { channel: 'invoice', zone: 'Cairo+Giza' }, { channel: 'invoice', zone: 'Cairo+Giza' }, { channel: 'invoice', zone: 'Cairo+Giza' },
            { channel: 'awb', zone: 'Other_Regions', tags: ['Bosta_Uploaded_S1'] },
            { channel: 'awb', zone: 'Other_Regions', tags: [] }, { channel: 'awb', zone: 'Other_Regions', tags: [] },
          ];
      return json({ ok: true, orders });
    }
    if (action === 'get_ready_orders') {
      return json({ ok: true, total: 3, orders: [{ courier: 'Saif' }, { courier: 'Saif' }, { courier: 'Bosta' }] });
    }
    if (action === 'get_ready_to_ship')      return json({ ok: true, orders: [], counts: { total: 0 } });
    if (action === 'get_ready_to_office')    return json({ ok: true, orders: [] });
    if (action === 'get_ready_to_warehouse') return json({ ok: true, orders: [] });

    if (action === 'get_done_counts') {
      calls.done = (calls.done || 0) + 1;
      if (mode.serverCounts) {
        const k = host.startsWith('order-printer-worker') ? 'print' : host.startsWith('orders-packing-checker-worker') ? 'pack' : 'ship';
        const [a, b] = mode.serverCounts[k];
        return json({ ok: true, today: mode.serverDay || TODAY, yesterday: 'x', counts: { today: a, yesterday: b } });
      }
      return json({ error: 'action غير معروف: get_done_counts' }, 400);   // Worker قديم
    }
    if (action === 'get_logs') {
      calls.logs.push({ host, params: Object.fromEntries(url.searchParams) });
      // تأخير اختياري — من غيره الرد فوري والزرار بيخلّص «جاري التحديث» قبل ما الاختبار يلحق يقيسه
      if (mode.delay) await new Promise(r => setTimeout(r, mode.delay));
      if (mode.logsFail && host.startsWith('order-printer-worker')) return json({ ok: false, error: 'boom' }, 500);
      if (mode.endless) {   // كل صفحة ١٠٠ صف طازة — السجل مش بيخلص
        const rows = Array.from({ length: 100 }, (_, i) => E(T_TODAY_MORNING, 'S1', 9000 + i));
        return json({ ok: true, entries: rows });
      }
      const rows = host.startsWith('order-printer-worker') ? PRINT_LOGS
                 : host.startsWith('orders-packing-checker-worker') ? PACK_LOGS
                 : host.startsWith('bosta-orders-shipped-scanner') ? SHIP_LOGS : [];
      return json({ ok: true, entries: rows });
    }
    return json({ ok: true });
  };
  return { stub, calls };
}

async function openHome(mode) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR_|status of (500|400)/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('warehouse_ops_worker_secret', 'test-secret-0123456789');
      sessionStorage.setItem('woc_session', JSON.stringify({ v: 1, username: 'tester', displayName: 'الموظف التجريبي', loginAt: new Date().toISOString() }));
    } catch {}
  });
  const { stub, calls } = makeStub(mode);
  await page.route('**/*.workers.dev/**', stub);
  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => document.querySelector('#cntOffice') && document.querySelector('#cntOffice').textContent.trim() !== '—', null, { timeout: 15000 });
  await page.waitForTimeout(900);
  return { page, ctx, calls, errors };
}
const txt = async (page, sel) => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();

// ══════════════════════════════════════════════════════════════
console.log('\n══ index.html — الشاشة الرئيسية ══');
console.log('① شريط «خلص» — الأرقام والتعريفات');
{
  const { page, ctx, calls, errors } = await openHome({});
  for (const [k, id, verb] of [['print', 'Print', 'اتطبع'], ['pack', 'Pack', 'اتغلّف'], ['ship', 'Bosta', 'اتسلّم لبوسطة']]) {
    const t = await txt(page, `#done${id} .woc-done-today`), y = await txt(page, `#done${id} .woc-done-yest`);
    is(t === String(EXPECT[k][0]) && y === String(EXPECT[k][1]),
       `${verb}: النهارده ${EXPECT[k][0]} · أمس ${EXPECT[k][1]}`, `طلع ${t} / ${y}`);
    is((await txt(page, `#done${id} .woc-done-lbl`)).includes(verb), `الفعل «${verb}» مكتوب`);
  }
  is(await page.locator('#doneBosta .woc-done-arr svg').count() === 1 && await page.locator('#donePrint .woc-ck svg').count() === 1,
     '✓ في دايرة + سهم بعد الاسم');
  is(await page.locator('.woc-done').count() === 3, 'الشريط في التلات صفوف بس (المكتب والمرتجعات ما دخلوش)');
  is(await page.locator('#doneOffice, #doneWarehouse').count() === 0, 'مفيش شريط في المكتب والمرتجعات');
  is(await page.locator('.woc-unit').count() === 0, 'كلمة «أوردر» اتشالت من الخمس صفوف');

  const first = calls.logs.find(c => c.host.startsWith('order-printer-worker'));
  is(first && first.params.dateFrom === addDays(YEST, -1) && first.params.dateTo === TODAY,
     '🔴 `dateFrom` = يوم UTC قبل أمس (فخ يوم القاهرة) و`dateTo` = النهارده', JSON.stringify(first && first.params));
  const ship = calls.logs.find(c => c.host.startsWith('bosta-orders-shipped-scanner'));
  is(ship && ship.params.types === 'update' && ship.params.results === 'success,warning', 'تسليم بوسطة: فلاتر `types`/`results` اتبعتت للتقليل', JSON.stringify(ship && ship.params));

  // اللون: رقم «اليوم» محايد ≠ الرقم الكبير
  const big = await page.locator('#cntPrint').evaluate(e => getComputedStyle(e).color);
  const today = await page.locator('#donePrint .woc-done-today').evaluate(e => getComputedStyle(e).color);
  is(big !== today && today === 'rgb(55, 65, 81)', '🔴 رقم «اليوم» رمادي غامق ومختلف عن لون الرقم الكبير', `${big} ↔ ${today}`);
  const yest = await page.locator('#donePrint .woc-done-yest').evaluate(e => getComputedStyle(e).color);
  is(yest !== today, '«أمس» أخف من «اليوم»');

  // الشريط جوّه الكارت وملزوق بحافته السفلية
  const rb = await page.locator('a.woc-row').first().boundingBox(), sb = await page.locator('#donePrint').boundingBox();
  is(sb.x >= rb.x - 1 && sb.x + sb.width <= rb.x + rb.width + 1 && Math.abs((sb.y + sb.height) - (rb.y + rb.height)) <= 3,
     'الشريط جوّه الكارت بعرضه كله وملزوق بحافته السفلية', `${JSON.stringify(sb)} ↔ ${JSON.stringify(rb)}`);
  is(await page.locator('a.woc-row').first().evaluate(e => e.tagName) === 'A', 'الصف كله لينك (الشريط جزء منه)');
  is(errors.length === 0, 'صفر خطأ في الكونسول', errors.join(' | '));
  await ctx.close();
}

console.log('② chips — مجموعة موصولة بخانات رقم');
{
  const { page, ctx } = await openHome({});
  const segs = page.locator('#chipsPrint .woc-cgroup .woc-seg');
  is(await segs.count() === 3, 'الطباعة: ٣ خانات في كبسولة واحدة');
  const nums = await page.locator('#chipsPrint .woc-seg-n').allTextContents();
  is(nums.join(',') === '3,1,0', 'أرقام الخانات (مناديب · بوسطة · شو روم) = 3,1,0', nums.join(','));
  const labels = await page.locator('#chipsPrint .woc-seg-t').allTextContents();
  is(labels.join('|') === 'مناديب|بوسطة|شو روم', 'الأسماء بالترتيب الثابت', labels.join('|'));

  // 🔴 الرقم على اليمين والاسم على اليسار
  const nb = await page.locator('#chipsPrint .woc-seg-n').first().boundingBox();
  const lb = await page.locator('#chipsPrint .woc-seg-t').first().boundingBox();
  is(nb.x > lb.x, '🔴 الرقم على **يمين** الاسم', `${nb.x} ↔ ${lb.x}`);

  const att = page.locator('#chipsPrint .woc-att');
  is(await att.count() === 1 && (await att.textContent()).includes('2'), 'بادج «في انتظار الرفع» (٢) على خانة بوسطة');
  is(await page.locator('#chipsPrint .woc-seg-t:text("بوسطة")').evaluate(e => !!e.closest('.woc-seg').querySelector('.woc-att')), 'البادج جوّه خانة بوسطة نفسها');
  is(await page.locator('#chipsPrint .chip-ch-pending').count() === 0, 'مفيش chip «في انتظار الرفع» لوحده');
  is(await page.locator('#chipsPrint .woc-seg.z0').count() === 1, 'الصفر (شو روم) باهت — خانة واحدة بس');
  const op = await page.locator('#chipsPrint .woc-seg.z0 .woc-seg-n').evaluate(e => getComputedStyle(e).opacity);
  is(Number(op) < 0.6, 'خانة الصفر opacity < .6', op);

  const pnums = await page.locator('#chipsPack .woc-seg-n').allTextContents();
  is(pnums.join(',') === '2,1,0', 'التغليف: 2,1,0 (نفس الكبسولة)', pnums.join(','));
  is(await page.locator('#chipsPack .woc-att').count() === 0, 'التغليف: مفيش بادج');
  await ctx.close();
}
{
  // 🔴 خانة بوسطة صفر + معلّق: الخانة باهتة **والبادج لا**
  const { page, ctx } = await openHome({ pendingOnly: true });
  const seg = page.locator('#chipsPrint .woc-seg', { hasText: 'بوسطة' });
  const isZero = await seg.evaluate(e => e.classList.contains('z0'));
  const opN = await seg.locator('.woc-seg-n').evaluate(e => getComputedStyle(e).opacity);
  const opB = await seg.locator('.woc-att').evaluate(e => getComputedStyle(e).opacity);
  is(isZero && Number(opN) < 0.6 && opB === '1', '🔴 بوسطة صفر: الرقم باهت **والبادج مابيبهتش**', `${isZero} · ${opN} · ${opB}`);
  await ctx.close();
}

console.log('③ الاستقلال والفشل');
{
  const { page, ctx, errors } = await openHome({ logsFail: true });
  const t = await txt(page, '#donePrint .woc-done-today'), w = await txt(page, '#donePrint .woc-done-warn');
  is(t === '—' && w.includes('تعذّر'), '🔴 فشل سجل الطباعة: «—» وعلامة «تعذّر» (مش صفر)', `${t} · ${w}`);
  is((await txt(page, '#cntPrint')) === '4', '🔴 والطابور شغّال (٤) — فشل «خلص» ما خفاهوش', await txt(page, '#cntPrint'));
  is((await txt(page, '#donePack .woc-done-today')) === '2', 'وباقي الأدوات ما اتأثرتش');
  is(errors.length === 0, 'صفر خطأ JS', errors.join(' | '));
  await ctx.close();
}
{
  const { page, ctx } = await openHome({ printQueueFail: true });
  is((await txt(page, '#cntPrint')) === 'تعذّر', 'فشل الطابور: «تعذّر» مش صفر');
  is((await txt(page, '#donePrint .woc-done-today')) === '5', '🔴 و«خلص» لسه معروض (٥) — فشل الطابور ما خفاهوش');
  await ctx.close();
}
{
  const { page, ctx, calls } = await openHome({ endless: true });
  const t = await txt(page, '#donePrint .woc-done-today'), w = await txt(page, '#donePrint .woc-done-warn');
  const n = calls.logs.filter(c => c.host.startsWith('order-printer-worker')).length;
  is(t === '—' && w.includes('تعذّر'), '🔴 سجل أطول من الحد = «تعذّر» مش رقم ناقص', `${t} · ${w}`);
  is(n === 15, 'حارس الحلقة وقف عند ١٥ صفحة بالظبط', String(n));
  await ctx.close();
}

console.log('④ التحديث اليدوي');
{
  const { page, ctx, calls } = await openHome({ delay: 500 });
  const before = calls.logs.filter(c => c.host.startsWith('order-printer-worker')).length;
  await page.click('#btnPrint');
  is(await page.locator('#btnPrint').evaluate(e => e.classList.contains('loading')), 'الزرار «بيتحدّث» لحد ما الاتنين يخلصوا');
  await page.waitForFunction(() => !document.querySelector('#btnPrint').classList.contains('loading'), null, { timeout: 8000 });
  const after = calls.logs.filter(c => c.host.startsWith('order-printer-worker')).length;
  is(after > before, 'ضغطة تحديث الصف جابت «خلص» تاني مع الطابور', `${before} → ${after}`);
  is((await txt(page, '#donePrint .woc-done-today')) === '5', 'الرقم لسه ٥ بعد التحديث');
  await ctx.close();
}

console.log('⑤ العدّ جاهز من الـ Worker (get_done_counts) + الرجوع للتصفيح');
{
  const { page, ctx, calls, errors } = await openHome({ serverCounts: { print: [41, 17], pack: [29, 12], ship: [8, 3] } });
  is((await txt(page, '#donePrint .woc-done-today')) === '41' && (await txt(page, '#donePrint .woc-done-yest')) === '17', 'الطباعة: الرقم من الـ Worker (41 / 17)');
  is((await txt(page, '#donePack .woc-done-today')) === '29' && (await txt(page, '#doneBosta .woc-done-today')) === '8', 'التغليف وتسليم بوسطة كمان من الـ Worker');
  is(calls.logs.length === 0, 'صفر نداء get_logs لما الـ Worker رجّع العدّ', `get_logs × ${calls.logs.length}`);
  is((calls.done || 0) >= 3, 'نادى get_done_counts على التلات Workers', String(calls.done));
  is(errors.length === 0, 'صفر خطأ في الكونسول', errors.join(' | '));
  await ctx.close();
}
{
  // يوم القاهرة عند الـ Worker غير عند الجهاز → رقم مش موثوق → الرجوع للتصفيح (مش رقم غلط)
  const { page, ctx, calls } = await openHome({ serverCounts: { print: [41, 17], pack: [29, 12], ship: [8, 3] }, serverDay: D2 });
  is((await txt(page, '#donePrint .woc-done-today')) === '5' && calls.logs.length > 0, 'يوم مختلف في الرد → رجع للتصفيح والرقم من السجل (5)');
  await ctx.close();
}
{
  // Worker قديم (get_done_counts → 400): التصفيح هو اللي بيشتغل — هو الوضع الافتراضي في ①–④
  const { page, ctx, calls } = await openHome({});
  is((calls.done || 0) >= 3 && (await txt(page, '#donePrint .woc-done-today')) === '5', 'Worker قديم (400) → الرجوع للتصفيح بنفس الأرقام');
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${fail ? '❌' : '✅'} ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
