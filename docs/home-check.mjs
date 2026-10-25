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
  const calls = { logs: [], orders: 0, upload: [] };
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
    // 🔴 «رفع بوسطة» — التلات أوضاع على نفس الـ Worker. العدّ = `!alreadyUploaded`: شحن ٣ (من ٤) · استرجاع ٢ · استبدال ١.
    if (host.startsWith('bosta-orders-upload-worker') && (action === 'get_orders' || action === 'fetch_candidates')) {
      let jobType = 's1';
      if (action === 'fetch_candidates') { try { jobType = JSON.parse(route.request().postData() || '{}').jobType; } catch {} }
      calls.upload.push({ action, jobType, auth: route.request().headers()['authorization'] });
      if (mode.uploadFail === jobType) return json({ ok: false, error: 'boom' }, 500);
      const rows = jobType === 's1' ? [{ alreadyUploaded: false }, { alreadyUploaded: false }, { alreadyUploaded: false }, { alreadyUploaded: true }]
                 : jobType === 'return' ? [{ alreadyUploaded: false }, { alreadyUploaded: false }] : [{ alreadyUploaded: false }];
      return json({ ok: true, rows });
    }
    if (action === 'get_ready_orders') {
      return json({ ok: true, total: 3, orders: [{ courier: 'Saif' }, { courier: 'Saif' }, { courier: 'Bosta' }] });
    }
    if (action === 'get_ready_to_ship')      return json({ ok: true, orders: [], counts: { total: 0 } });
    if (action === 'get_ready_to_office')    return json({ ok: true, orders: [] });
    if (action === 'get_ready_to_warehouse') return json({ ok: true, orders: [] });
    if (action === 'get_return_items') return json({ ok: true, items: [], counts: { pending: 0, missing: 0 }, truncated: false });   // v1.51.0 — صف «قطع مستنية الرجوع»

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
  // لتسجيل كل `setInterval`/`setTimeout` بمدة ≥ ١٠ دقايق (بند ⑥ — مفيش تحديث تلقائي)
  await page.addInitScript(() => {
    window.__longTimers = [];
    for (const n of ['setInterval', 'setTimeout']) {
      const o = window[n]; window[n] = (fn, ms, ...a) => { if (ms >= 600000) window.__longTimers.push(n + ':' + ms); return o(fn, ms, ...a); };
    }
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
    const t = await txt(page, `#done${id} .eco-done-today`), y = await txt(page, `#done${id} .eco-done-yest`);
    is(t === String(EXPECT[k][0]) && y === String(EXPECT[k][1]),
       `${verb}: النهارده ${EXPECT[k][0]} · أمس ${EXPECT[k][1]}`, `طلع ${t} / ${y}`);
    is((await txt(page, `#done${id} .eco-done-lbl`)).includes(verb), `الفعل «${verb}» مكتوب`);
  }
  is(await page.locator('#doneBosta .eco-done-arr svg').count() === 1 && await page.locator('#donePrint .eco-ck svg').count() === 1,
     '✓ في دايرة + سهم بعد الاسم');
  is(await page.locator('.eco-done').count() === 3, 'الشريط في التلات صفوف بس (المكتب والمرتجعات ما دخلوش)');
  is(await page.locator('#doneOffice, #doneWarehouse').count() === 0, 'مفيش شريط في المكتب والمرتجعات');
  is(await page.locator('.eco-unit').count() === 0, 'كلمة «أوردر» اتشالت من الخمس صفوف');

  const first = calls.logs.find(c => c.host.startsWith('order-printer-worker'));
  is(first && first.params.dateFrom === addDays(YEST, -1) && first.params.dateTo === TODAY,
     '🔴 `dateFrom` = يوم UTC قبل أمس (فخ يوم القاهرة) و`dateTo` = النهارده', JSON.stringify(first && first.params));
  const ship = calls.logs.find(c => c.host.startsWith('bosta-orders-shipped-scanner'));
  is(ship && ship.params.types === 'update' && ship.params.results === 'success,warning', 'تسليم بوسطة: فلاتر `types`/`results` اتبعتت للتقليل', JSON.stringify(ship && ship.params));

  // اللون: رقم «اليوم» محايد ≠ الرقم الكبير
  const big = await page.locator('#cntPrint').evaluate(e => getComputedStyle(e).color);
  const today = await page.locator('#donePrint .eco-done-today').evaluate(e => getComputedStyle(e).color);
  is(big !== today && today === 'rgb(55, 65, 81)', '🔴 رقم «اليوم» رمادي غامق ومختلف عن لون الرقم الكبير', `${big} ↔ ${today}`);
  const yest = await page.locator('#donePrint .eco-done-yest').evaluate(e => getComputedStyle(e).color);
  is(yest !== today, '«أمس» أخف من «اليوم»');

  // الشريط جوّه الكارت وملزوق بحافته السفلية
  const rb = await page.locator('#rowPrint').boundingBox(), sb = await page.locator('#donePrint').boundingBox();
  is(sb.x >= rb.x - 1 && sb.x + sb.width <= rb.x + rb.width + 1 && Math.abs((sb.y + sb.height) - (rb.y + rb.height)) <= 3,
     'الشريط جوّه الكارت بعرضه كله وملزوق بحافته السفلية', `${JSON.stringify(sb)} ↔ ${JSON.stringify(rb)}`);
  is(await page.locator('a.eco-row').first().evaluate(e => e.tagName) === 'A', 'الصف كله لينك (الشريط جزء منه)');
  is(errors.length === 0, 'صفر خطأ في الكونسول', errors.join(' | '));
  if (process.env.ECO_SHOT) await page.screenshot({ path: process.env.ECO_SHOT, fullPage: true });   // لقطة للمراجعة بالعين
  await ctx.close();
}

console.log('② chips — «مجموعة موصولة» (G · قرار أحمد 22-10-2026 من مختبر الـ chips)');
// نص كل خانة داخل الكبسولة: الرقم ثم الاسم (من غير بادج الانتظار) + هل هي باهتة
const segs = (page, id) => page.locator(`#${id} .eco-cgroup .eco-chip`).evaluateAll(els => els.map(e => ({
  t: e.querySelector('b').textContent + ' ' + e.querySelector('span:not(.eco-att)').textContent.trim(),
  dim: Number(getComputedStyle(e.querySelector('b')).opacity) < 0.6, att: e.querySelector('.eco-att')?.textContent.trim() || null,
})));
{
  const { page, ctx } = await openHome({});
  is(await page.locator('#chipsPrint .eco-cgroup').count() === 1, 'الطباعة: كبسولة موصولة واحدة');
  const g = await segs(page, 'chipsPrint');
  is(g.map(x => x.t).join('|') === '3 مناديب|1 بوسطة|0 شو روم', 'الطباعة: الخانات بالترتيب الثابت والرقم قبل الاسم (يمين → يسار)', g.map(x => x.t).join('|'));
  is(g[2].dim && !g[0].dim && !g[1].dim, 'الصفر (شو روم) باهت والباقي لأ');
  is(g[1].att === '2' && g[0].att === null, '🔴 «في انتظار الرفع على بوسطة» بادج ⏳ (٢) على خانة بوسطة بس', JSON.stringify(g));
  is(await page.locator('#chipsPrint .eco-att').getAttribute('title') === 'في انتظار الرفع على بوسطة', 'والبادج بيقول معناه في الـ title');
  is((await page.locator('#chipsPrint .eco-chip:not(.eco-cgroup .eco-chip)').count()) === 0, 'ولا مربع لوحده برّه الكبسولة (الانتظار بقى بادج)');
  const pk = await segs(page, 'chipsPack');
  is(pk.map(x => x.t).join('|') === '2 مناديب|1 بوسطة|0 شو روم', 'التغليف: نفس التقسيمة (٢ · ١ · ٠) في كبسولة موصولة', pk.map(x => x.t).join('|'));
  const al = await page.locator('#chipsPrint').evaluate(e => getComputedStyle(e).justifyContent);
  is(al === 'center', 'الـ chips في النص');
  await ctx.close();
}
{
  // بادج الانتظار مايبهتش حتى وخانة بوسطة صفر (ده تحذير)
  const { page, ctx } = await openHome({ pendingOnly: true });
  const g = await segs(page, 'chipsPrint');
  const bo = g.find(x => x.t.endsWith('بوسطة'));
  is(bo && bo.t.startsWith('0 ') && bo.att === '2', 'بوسطة صفر + معلّق: الصفر ظاهر والبادج ⏳ على الخانة', JSON.stringify(g));
  const attOp = await page.locator('#chipsPrint .eco-att').evaluate(e => { let o = 1; for (let n = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; });
  is(attOp === 1, 'البادج مابيبهتش مع الصفر (بالورث كمان)', String(attOp));
  await ctx.close();
}

console.log('③ الاستقلال والفشل');
{
  const { page, ctx, errors } = await openHome({ logsFail: true });
  const t = await txt(page, '#donePrint .eco-done-today'), w = await txt(page, '#donePrint .eco-done-warn');
  is(t === '—' && w.includes('تعذّر'), '🔴 فشل سجل الطباعة: «—» وعلامة «تعذّر» (مش صفر)', `${t} · ${w}`);
  is((await txt(page, '#cntPrint')) === '4', '🔴 والطابور شغّال (٤) — فشل «خلص» ما خفاهوش', await txt(page, '#cntPrint'));
  is((await txt(page, '#donePack .eco-done-today')) === '2', 'وباقي الأدوات ما اتأثرتش');
  is(errors.length === 0, 'صفر خطأ JS', errors.join(' | '));
  await ctx.close();
}
{
  const { page, ctx } = await openHome({ printQueueFail: true });
  is((await txt(page, '#cntPrint')) === 'تعذّر', 'فشل الطابور: «تعذّر» مش صفر');
  is((await txt(page, '#donePrint .eco-done-today')) === '5', '🔴 و«خلص» لسه معروض (٥) — فشل الطابور ما خفاهوش');
  await ctx.close();
}
{
  const { page, ctx, calls } = await openHome({ endless: true });
  const t = await txt(page, '#donePrint .eco-done-today'), w = await txt(page, '#donePrint .eco-done-warn');
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
  is(await page.locator('#btnPrint').evaluate(e => e.disabled && e.getAttribute('aria-busy') === 'true') && await page.locator('#rowPrint').evaluate(e => e.classList.contains('is-loading')), 'الزرار «بيتحدّث» (جاري) والصف `is-loading` لحد ما الاتنين يخلصوا');
  await page.waitForFunction(() => !document.querySelector('#btnPrint').disabled, null, { timeout: 8000 });
  const after = calls.logs.filter(c => c.host.startsWith('order-printer-worker')).length;
  is(after > before, 'ضغطة تحديث الصف جابت «خلص» تاني مع الطابور', `${before} → ${after}`);
  is((await txt(page, '#donePrint .eco-done-today')) === '5', 'الرقم لسه ٥ بعد التحديث');
  await ctx.close();
}

console.log('⑤ العدّ جاهز من الـ Worker (get_done_counts) + الرجوع للتصفيح');
{
  const { page, ctx, calls, errors } = await openHome({ serverCounts: { print: [41, 17], pack: [29, 12], ship: [8, 3] } });
  is((await txt(page, '#donePrint .eco-done-today')) === '41' && (await txt(page, '#donePrint .eco-done-yest')) === '17', 'الطباعة: الرقم من الـ Worker (41 / 17)');
  is((await txt(page, '#donePack .eco-done-today')) === '29' && (await txt(page, '#doneBosta .eco-done-today')) === '8', 'التغليف وتسليم بوسطة كمان من الـ Worker');
  is(calls.logs.length === 0, 'صفر نداء get_logs لما الـ Worker رجّع العدّ', `get_logs × ${calls.logs.length}`);
  is((calls.done || 0) >= 3, 'نادى get_done_counts على التلات Workers', String(calls.done));
  is(errors.length === 0, 'صفر خطأ في الكونسول', errors.join(' | '));
  await ctx.close();
}
{
  // يوم القاهرة عند الـ Worker غير عند الجهاز → رقم مش موثوق → الرجوع للتصفيح (مش رقم غلط)
  const { page, ctx, calls } = await openHome({ serverCounts: { print: [41, 17], pack: [29, 12], ship: [8, 3] }, serverDay: D2 });
  is((await txt(page, '#donePrint .eco-done-today')) === '5' && calls.logs.length > 0, 'يوم مختلف في الرد → رجع للتصفيح والرقم من السجل (5)');
  await ctx.close();
}
{
  // Worker قديم (get_done_counts → 400): التصفيح هو اللي بيشتغل — هو الوضع الافتراضي في ①–④
  const { page, ctx, calls } = await openHome({});
  is((calls.done || 0) >= 3 && (await txt(page, '#donePrint .eco-done-today')) === '5', 'Worker قديم (400) → الرجوع للتصفيح بنفس الأرقام');
  await ctx.close();
}

console.log('⑥ بلا تحديث تلقائي + الرئيسية من الكاش (٥ طوابير · ١٠ دقايق)');
{
  const { page, ctx, calls } = await openHome({});
  const snap = () => ({ orders: calls.orders, done: calls.done || 0, logs: calls.logs.length });
  const timers = await page.evaluate(() => window.__longTimers);
  is(timers.length === 0, '🔴 مفيش أي مؤقّت ≥ ١٠ دقايق (تحديث تلقائي اتشال)', JSON.stringify(timers));
  const keys = await page.evaluate(() => ['print','pack','bosta','office','warehouse'].map(k => sessionStorage.getItem('woc_queue_' + k) !== null));
  is(keys.every(Boolean), 'كل طابور اتكتب في الكاش بعد أول جلب (٥ مفاتيح)', JSON.stringify(keys));
  const dk = await page.evaluate(() => ['print','pack','bosta'].map(k => sessionStorage.getItem('woc_done_' + k) !== null));
  is(dk.every(Boolean), 'و«خلص» اتكتب في كاشه (٣ مفاتيح)', JSON.stringify(dk));
  const before = snap();
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#cntOffice') && document.querySelector('#cntOffice').textContent.trim() !== '—', null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const after = snap();
  is(JSON.stringify(before) === JSON.stringify(after), '🔴 الفتح التاني خلال ١٠ دقايق = صفر نداء (طابور ولا «خلص»)', `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  is((await txt(page, '#cntPrint')) === '4' && (await txt(page, '#donePrint .eco-done-today')) === '5', 'والأرقام معروضة من الكاش (٤ · ٥)');
  is((await txt(page, '#agoPrint')).length > 0 && (await txt(page, '#stampPrint')) !== '—', 'والصف بيقول عمره وبختم وقت الكاش');
  // كاش الطباعة أقدم من ١٠ دقايق → الطباعة بس هي اللي بتتجاب
  await page.evaluate(() => { const c = JSON.parse(sessionStorage.getItem('woc_queue_print')); c.at = new Date(Date.now() - 11 * 60000).toISOString(); sessionStorage.setItem('woc_queue_print', JSON.stringify(c)); });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#cntOffice') && document.querySelector('#cntOffice').textContent.trim() !== '—', null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const after2 = snap();
  is(after2.orders === after.orders + 1, 'كاش الطباعة ١١ دقيقة → اتجاب هو بس (+١ على /orders)', `${after.orders} → ${after2.orders}`);
  const packCalls = calls.logs.filter(c => c.host.startsWith('orders-packing-checker-worker')).length;
  is(packCalls === 1, 'والتغليف فضل من الكاش (صفر نداء جديد)', String(packCalls));
  await ctx.close();
}

console.log('⑦ التصميم الموحّد — الأقسام الخمسة والهوية والإطار (قرار أحمد 22-10-2026)');
{
  const { page, ctx, errors } = await openHome({});
  const secs = await page.evaluate(() => [...document.querySelectorAll('.eco-home-sec')].map(s => ({
    id: s.id, title: s.querySelector('.eco-home-sec-title').textContent.trim(),
    rows: [...s.querySelectorAll('.eco-qrow')].map(r => r.id), tools: [...s.querySelectorAll('.eco-tool')].map(a => a.getAttribute('href')),
    open: !s.classList.contains('is-collapsed'), sum: !!s.querySelector('.eco-sum') })));
  is(secs.map(s => s.title).join('|') === 'قسم تجهيز الأوردر|قسم التسليمات|قسم المرتجعات|أدوات مساعدة|أدوات أخرى', '🔴 خمس أقسام بالأسماء والترتيب المتفق عليه', secs.map(s => s.title).join('|'));
  is(secs[0].rows.join() === 'rowBostaUpload,rowPrint,rowPack' && secs[1].rows.join() === 'rowBosta,rowOffice' && secs[2].rows.join() === 'rowWarehouse,rowReturnItems,rowBostaReturns',
     'الصفوف في أقسامها: (رفع بوسطة · طباعة · تغليف) · (بوسطة · مكتب) · (رجوع للمخزن · قطع مستنية الرجوع · مرتجعات بوسطة)', JSON.stringify(secs.map(s => s.rows)));
  is(secs[3].tools.join() === 'Order-Item-Remover.html,Order-SKU-Barcode-Printer.html' && secs[4].tools.join() === 'Inventory-Audit-Updater.html,stats.html',
     'الأدوات: مساعدة (عطلان · باركود) · أخرى (الجرد · الإحصائيات) — **كروت** مش pills', JSON.stringify([secs[3].tools, secs[4].tools]));
  is(secs.every(s => s.open && s.sum), 'كلها مفتوحة عند الفتح، وكلها ليها ملخّص مطوي (بلاطات — الأدوات كمان)');
  // 🎨 المطوي: العنوان على اليمين في **كل** الأقسام (أقسام الأدوات كانت في النص) — طلب أحمد 22-10-2026
  for (const id of ['secPrep', 'secHelper', 'secOther']) await page.locator(`#${id} [data-sec-toggle] .eco-sec-chev`).click();
  await page.waitForTimeout(400);
  if (process.env.ECO_SHOT3) await page.screenshot({ path: process.env.ECO_SHOT3, fullPage: true });
  const pos = await page.evaluate(() => ['secPrep', 'secHelper', 'secOther'].map(id => {
    const h = document.querySelector(`#${id} .eco-home-sec-hd`).getBoundingClientRect(), t = document.querySelector(`#${id} .eco-home-sec-ico`).getBoundingClientRect();
    return Math.round(h.right - t.right);
  }));
  is(pos.every(x => Math.abs(x - pos[0]) <= 2), '🎨 المطوي: أيقونة/عنوان كل الأقسام على اليمين بنفس البُعد (الأدوات مش في النص)', pos.join(','));
  for (const id of ['secPrep', 'secHelper', 'secOther']) await page.locator(`#${id} [data-sec-toggle] .eco-sec-chev`).click();
  // مرتجعات بوسطة = صف بلا طابور
  const link = await page.evaluate(() => { const r = document.getElementById('rowBostaReturns');
    return { tag: r.tagName, href: r.getAttribute('href'), link: r.classList.contains('is-link'), num: r.querySelector('.eco-count').textContent.trim(),
             btn: !!r.querySelector('.eco-qref'), open: r.querySelector('.eco-open').textContent.trim(), inQ: 'bostaReturns' in homeQ, ageBox: !!r.querySelector('.eco-agebox') }; });
  is(link.tag === 'A' && link.href === 'Bosta-Orders-Returned-Scanner.html' && link.link && link.num === '—' && !link.btn && !link.ageBox && link.open.includes('فتح الأداة') && !link.inQ,
     '🔴 «مرتجعات بوسطة» **صف** (مش كارت) بلا عدّاد: `—` + «فتح الأداة ←» وبلا تحديث ولا جلب', JSON.stringify(link));
  // مفيش حافة · الخلفية بتتلوّن بالعمر
  const edge = await page.evaluate(() => { homeQ.print.at = new Date(Date.now() - 35 * 60000); renderFreshness();
    const r = document.getElementById('rowPrint'); return { e: getComputedStyle(r, '::before').content, cls: [...r.classList].find(c => c.startsWith('age-')) }; });
  is(edge.e === 'none' && edge.cls === 'age-warn', '⛔ مفيش حافة جانبية ملوّنة، ولون العمر على الخلفية والمربع والزرار', JSON.stringify(edge));
  // ألوان الهوية: ٦ ألوان مختلفة وبعيدة عن سلّم العمر
  const cols = await page.evaluate(() => {
    const v = n => { const d = document.createElement('i'); d.style.color = `var(${n})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    return { ids: ['rowPrint', 'rowPack', 'rowBosta', 'rowOffice', 'rowWarehouse', 'rowBostaReturns', 'rowBostaUpload'].map(i => getComputedStyle(document.getElementById(i).querySelector('.eco-card-name')).color),
             age: [v('--green'), v('--accent'), v('--amber'), v('--red'), v('--green-dark'), v('--accent-dark'), v('--amber-dark'), v('--red-dark')] }; });
  is(new Set(cols.ids).size === 7 && cols.ids.every(c => !cols.age.includes(c)), '🎨 ٧ ألوان هوية مختلفة، ولا واحد منهم لون من سلّم العمر', cols.ids.join(' | '));
  const want = { rowPrint: 'rgb(67, 56, 202)', rowPack: 'rgb(14, 116, 144)', rowBosta: 'rgb(190, 24, 93)', rowOffice: 'rgb(162, 28, 175)', rowWarehouse: 'rgb(120, 53, 15)', rowBostaReturns: 'rgb(154, 91, 36)', rowBostaUpload: 'rgb(109, 40, 217)' };
  is(Object.keys(want).every((k, i) => cols.ids[i] === want[k]), '🎨 الألوان المعتمدة: إنديجو · سيان · وردي · فوشيا · بني غامق · كراميل · بنفسجي (رفع بوسطة)', cols.ids.join(' | '));
  // خطين العنوان بلون العنوان + إطار المطوي
  const lines = await page.evaluate(() => [...document.querySelectorAll('.eco-home-sec')].every(s => { const c = getComputedStyle(s.querySelector('.eco-home-sec-title')).color;
    return [...s.querySelectorAll('.eco-sec-ln')].every(l => getComputedStyle(l).backgroundColor === c); }));
  is(lines, 'خطين العنوان على الجانبين بنفس لون العنوان');
  await page.click('#secDeliver .eco-sec-chev'); await page.waitForTimeout(450);
  const fr = await page.evaluate(() => { const hd = document.querySelector('#secDeliver .eco-home-sec-hd'); return { bc: getComputedStyle(hd).borderTopColor, bw: getComputedStyle(hd).borderTopWidth,
    tc: getComputedStyle(document.querySelector('#secDeliver .eco-home-sec-title')).color, pills: [...document.querySelectorAll('#secDeliver .eco-sm')].map(w => w.querySelector('.eco-sm-n').textContent.trim()) }; });
  is(fr.bc === fr.tc && parseFloat(fr.bw) >= 2 && fr.pills.join('|') === 'جاهز لتسليم بوسطة|جاهز للتسليم للمكتب', '🎨 المطوي: إطار بنفس لون العنوان + ملخّص بأسماء الصفوف', JSON.stringify(fr));
  // عطلان = الثيم الأحمر الوحيد
  const dng = await page.evaluate(() => [...document.querySelectorAll('.eco-tool.tool-danger')].map(a => a.getAttribute('href')));
  is(dng.join() === 'Order-Item-Remover.html', '🔴 الثيم الأحمر لـ«عطلان؟» وحده (الأداة الهدّامة)', dng.join());
  is(errors.length === 0, 'صفر خطأ في الكونسول', errors.join(' | '));
  await ctx.close();
}

console.log('⑧ «رفع بوسطة» — أول صف في «تجهيز الأوردر» بعدّاد حيّ (v1.50.0)');
{
  const { page, ctx, calls, errors } = await openHome({});
  is(await txt(page, '#cntBostaUpload') === '6', '🔴 الرقم الكبير = مجموع «لم يتم الرفع» في الأوضاع التلاتة (٣ + ٢ + ١ — والمرفوع قبل كده مش بيتعدّ)', await txt(page, '#cntBostaUpload'));
  const chips = await page.evaluate(() => [...document.querySelectorAll('#rowBostaUpload .eco-chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  is(chips.length === 3 && chips[0].includes('شحن') && chips[0].startsWith('3') && chips[1].includes('استرجاع') && chips[1].startsWith('2') && chips[2].includes('استبدال') && chips[2].startsWith('1'),
     'التلات chips بأرقامها (شحن ٣ · استرجاع ٢ · استبدال ١)', JSON.stringify(chips));
  is(await page.evaluate(() => document.getElementById('rowBostaUpload').getAttribute('href')) === 'Bosta-Orders-Upload.html', 'الصف بيفتح صفحة الأداة');
  is(calls.upload.length === 3 && calls.upload.some(c => c.action === 'get_orders') && ['return', 'exchange'].every(j => calls.upload.some(c => c.jobType === j)),
     'التلات نداءات اتبعتت (get_orders + fetch_candidates لـ return و exchange)', JSON.stringify(calls.upload.map(c => c.jobType)));
  is(calls.upload.every(c => c.auth === 'Bearer test-secret-0123456789'), '🔴 بسر مجموعة المخزن (`warehouse_ops_worker_secret`) مش سر الشحن', JSON.stringify(calls.upload.map(c => c.auth)));
  // الكاش: مفتاح مستقل ومايدوسش على كاش تسليمات بوسطة
  const ck = await page.evaluate(() => ({ up: JSON.parse(sessionStorage.getItem('woc_queue_bosta_upload') || 'null'), ship: JSON.parse(sessionStorage.getItem('woc_queue_bosta') || 'null') }));
  is(ck.up && ck.up.s1 && ck.up.s1.n === 3 && ck.up.return.n === 2 && ck.up.exchange.n === 1, 'الكاش `woc_queue_bosta_upload` = عدّادات الأوضاع التلاتة', JSON.stringify(ck.up));
  is(ck.ship && ck.ship.data && Array.isArray(ck.ship.data.orders) && !ck.ship.s1, '🔴 وكاش «جاهز لتسليم بوسطة» (`woc_queue_bosta`) فضل رد الـ Worker الخام — ماتدهسش', JSON.stringify(ck.ship).slice(0, 80));
  const idx = await page.evaluate(() => ({ prep: [...document.querySelectorAll('#secPrep .eco-qrow')].map(r => r.id)[0], hasAge: !!document.querySelector('#rowBostaUpload .eco-agebox'), btn: !!document.querySelector('#rowBostaUpload .eco-qref'), done: !!document.querySelector('#rowBostaUpload .eco-done') }));
  is(idx.prep === 'rowBostaUpload' && idx.hasAge && idx.btn && !idx.done, 'أول صف في القسم · مربع «آخر تحديث» وزرار التحديث · وبلا شريط «خلص» (قرار أحمد)', JSON.stringify(idx));
  // فتح تاني من الكاش = صفر نداء رفع
  const n0 = calls.upload.length;
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#cntOffice') && document.querySelector('#cntOffice').textContent.trim() !== '—', null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  is(calls.upload.length === n0 && await txt(page, '#cntBostaUpload') === '6', 'الفتح التاني خلال ١٠ دقايق = صفر نداء رفع والرقم من الكاش', `${n0} → ${calls.upload.length}`);
  is(errors.length === 0, 'صفر خطأ في الكونسول', errors.join(' | '));
  await ctx.close();
}
{ // فشل وضع واحد = الصف كله فشل بيسمّي الوضع (مش رقم ناقص شكله سليم) والباقي مابيتأثرش
  const { page, ctx } = await openHome({ uploadFail: 'exchange' });
  const t = await txt(page, '#rowBostaUpload');
  is(t.includes('استبدال') && t.includes('تعذّر') && await txt(page, '#cntPrint') === '4', '🔴 فشل وضع الاستبدال: الصف بيقول «تعذّر» ويسمّي الوضع، وصف الطباعة سليم', t.slice(0, 140));
  await ctx.close();
}


console.log('⑩ §FOLD — حفظ حالة الطي (sessionStorage) + «افتح الكل / اقفل الكل» (طلب أحمد 25-10-2026)');
{
  const { page, ctx, errors } = await openHome({});
  const st = () => page.evaluate(() => [...document.querySelectorAll('.eco-home-sec')].map(s => ({ id: s.id, c: s.classList.contains('is-collapsed'), e: s.querySelector('[data-sec-toggle]').getAttribute('aria-expanded') })));
  const stored = () => page.evaluate(() => sessionStorage.getItem('woc_home_fold'));
  const reload = async () => { await page.reload(); await page.waitForTimeout(1300); };
  is((await st()).every(x => !x.c && x.e === 'true') && (await st()).length === 5, 'أول فتح (بلا حالة محفوظة): الخمس أقسام مفتوحة');
  is(await page.$$eval('.eco-fold-bar .eco-fold-btn', b => b.map(x => x.textContent.trim()).join('|')) === 'افتح الكل|اقفل الكل', 'زرارين «افتح الكل» و«اقفل الكل» فوق الأقسام');
  await page.locator('#secPrep [data-sec-toggle] .eco-sec-chev').click(); await page.waitForTimeout(300);
  is(JSON.parse(await stored()).Prep === true, 'طي قسم = بيتحفظ في `sessionStorage` (المطوي بس)', await stored());
  await reload();
  let s2 = await st();
  is(s2.find(x => x.id === 'secPrep').c && s2.find(x => x.id === 'secPrep').e === 'false' && s2.filter(x => !x.c).length === 4, '🔴 الريفريش بيرجّع القسم **مطوي** والباقي مفتوح (و`aria-expanded` متظبط)', JSON.stringify(s2));
  is(await page.evaluate(() => getComputedStyle(document.querySelector('#secPrep .eco-sec-in')).visibility) === 'hidden', 'والصفوف المطوية مخفية (مفيش تاب ولا قارئ شاشة)');
  await page.click('[data-fold-all="close"]'); await page.waitForTimeout(300);
  is((await st()).every(x => x.c && x.e === 'false'), '«اقفل الكل» بيطوي كل الأقسام');
  await reload();
  is((await st()).every(x => x.c), '…والحالة بتتحفظ بعد الريفريش');
  is(await page.$$eval('#homeRoot .eco-sm', a => a.length) > 0, 'الملخّص المطوي (بلاطات) لسه بيتعرض');
  await page.click('[data-fold-all="open"]'); await page.waitForTimeout(300);
  is((await st()).every(x => !x.c && x.e === 'true') && (await stored()) === '{}', '«افتح الكل» بيفتح الكل وبيصفّر المحفوظ');
  await reload();
  is((await st()).every(x => !x.c), '…وبعد الريفريش كله مفتوح');
  await page.evaluate(() => sessionStorage.setItem('woc_home_fold', '{bad json'));
  await reload();
  is((await st()).every(x => !x.c) && errors.length === 0, '🔴 قيمة مخزّنة باظت: كله مفتوح وصفر خطأ في الكونسول', errors.join(' | '));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${fail ? '❌' : '✅'} ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
