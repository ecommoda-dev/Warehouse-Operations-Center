// ══════════════════════════════════════════════════════════════
// docs/office-check.mjs — فحص متصفح فعلي لـ `office-transfer.html`
//
// 🔴 **ليه ملف خامس؟** نفس قرار الأربعة اللي قبله: كل ملف بيشغّل Worker وهمي
//    بشكل رد **مختلف تمامًا**. الأداة دي عقدها فريد: الـ Worker بيرجّع
//    أوردرات `Ready` **خام** والواجهة هي اللي بتفلتر — عكس كل الأدوات
//    التانية. Worker وهمي مشترك كان هيخلّي أول تعديل في رد واحدة يكسر
//    اختبار التانية.
//
// 🔴 **وعيلة الفشل هنا صامتة بالكامل:**
//    ① شرط أهلية اتكتب في الصفحة بدل الـ shell → الطابور والشاشة الرئيسية
//      بيقولوا رقمين مختلفين، **وصفر خطأ في الكونسول** (درس R1 · v1.11.0).
//    ② صف S2 بيتفحص بوقت تغليف S1 → طرد ما اتغلّفش بيعدّي، **بلا أي رسالة**.
//    ③ الصف مابيتشالش من الطابور بعد النجاح → الشاشة زي ما هي فالموظف بيسكن
//      تاني (٥٩ صف فشل كذّاب في سكانر المرتجعات).
//    تلاتتهم **مستحيل يتمسكوا بمراجعة كود** — بيتمسكوا بتشغيل الصفحة فعلاً.
//
// التشغيل:  npm i playwright postcss --no-save && node docs/office-check.mjs
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

// ══════════════════════════════════════════════════════════════
// الرد الخام — **زي الـ Worker الحقيقي بالظبط: `Ready` بس، بلا أي فلترة**
// ══════════════════════════════════════════════════════════════
//
// 🔴 القايمة دي فيها **مؤهلين وغير مؤهلين مع بعض عن قصد**. ده بالظبط اللي
//    الـ endpoint الحقيقي بيرجّعه، والبند اللي بيتقفل هنا هو إن **الواجهة
//    بتفلتر صح** — لو الفلتر اتشال، الجدول هيعرض التمانية كلهم.
// ⚠️ ومفيش سطر واحد من الفلترة دي مكتوب في `office-transfer.html` — كله في
//    `shared/shell.js` §OFFICE-GATE، والاختبار بيقارن الاتنين تحت.
const RAW = [
  // ✅ مؤهل — S1 عادي، قاهرة+جيزة، متغلّف، عهدته فاضية
  { orderId:'7212244533570', orderName:'#54727', createdAt:'2026-09-12T08:00:00Z', cancelledAt:null,
    customer:'أحمد سمير', itemsQty:2, total:'1825.00', zone:'Cairo+Giza', courier:null,
    s1:'Ready', s2:null, packedAtS1:'2026-09-14T14:29:48Z', packedAtS2:null,
    packedByS1:'Mohammed Tarek', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // ✅ مؤهل — شو روم
  { orderId:'7212244533571', orderName:'#54580', createdAt:'2026-09-11T08:00:00Z', cancelledAt:null,
    customer:'منى فؤاد', itemsQty:1, total:'990.00', zone:'Show_Room', courier:'Showroom',
    s1:'Ready', s2:null, packedAtS1:'2026-09-14T09:23:01Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Warehouse', whereaboutsS2:null },
  // ✅ مؤهل — دورة استبدال: S1 = Delivered و S2 = Ready **ومتغلّف على S2**
  { orderId:'7212244533572', orderName:'#54296', createdAt:'2026-09-09T08:00:00Z', cancelledAt:null,
    customer:'كريم لطفي', itemsQty:1, total:'1500.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Delivered', s2:'Ready', packedAtS1:'2026-09-12T06:43:11Z', packedAtS2:'2026-09-14T08:20:10Z',
    packedByS1:'Abo Selim', packedByS2:'Marwan Mohammed', whereaboutsS1:null, whereaboutsS2:null },

  // ❌ بوسطة — **تلت الطابور الحقيقي يوم القياس**. لو ظهر، نفس الأوردر
  //    بيتعدّ في صف «جاهز لتسليم بوسطة» **وفي صف المكتب**.
  { orderId:'7212244533573', orderName:'#54777', createdAt:'2026-09-14T08:00:00Z', cancelledAt:null,
    customer:'سارة محمود', itemsQty:1, total:'700.00', zone:'Other_Regions', courier:'Bosta',
    s1:'Ready', s2:null, packedAtS1:'2026-09-14T10:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // ❌ ما اتغلّفش
  { orderId:'7212244533574', orderName:'#54773', createdAt:'2026-09-14T08:00:00Z', cancelledAt:null,
    customer:'هبة علي', itemsQty:1, total:'500.00', zone:'Cairo+Giza', courier:null,
    s1:'Ready', s2:null, packedAtS1:null, packedAtS2:null,
    packedByS1:null, packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // ❌ ملغي — متغلّف وكل حاجة تمام، بس ملغي
  { orderId:'7212244533575', orderName:'#54700', createdAt:'2026-09-13T08:00:00Z',
    cancelledAt:'2026-09-14T18:00:00Z',
    customer:'محمد جمال', itemsQty:1, total:'450.00', zone:'Cairo+Giza', courier:null,
    s1:'Ready', s2:null, packedAtS1:'2026-09-13T09:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Warehouse', whereaboutsS2:null },
  // ❌ في المكتب خلاص
  { orderId:'7212244533576', orderName:'#54690', createdAt:'2026-09-13T08:00:00Z', cancelledAt:null,
    customer:'ياسمين رأفت', itemsQty:1, total:'800.00', zone:'Cairo+Giza', courier:null,
    s1:'Ready', s2:null, packedAtS1:'2026-09-13T09:30:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Office', whereaboutsS2:null },
  // 🔴 ❌ **الصف اللي البند اتكتب عشانه**: S2 = Ready ومتغلّف على **S1 بس**.
  //    الفحص بـ`s1_packing_date_time` كان هيعدّيه — والطرد ده **ما اتغلّفش**.
  { orderId:'7212244533577', orderName:'#54173', createdAt:'2026-09-08T08:00:00Z', cancelledAt:null,
    customer:'نهى صبري', itemsQty:1, total:'1200.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Delivered', s2:'Ready', packedAtS1:'2026-09-10T11:06:53Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
];
const ELIGIBLE_NAMES = ['#54727', '#54580', '#54296'];

// ⚠️ **الأوردر الشاذ مش في الطابور** — S2 = Ready و S1 لسه `Shipped`.
//    بيترفض في الطابور، والـ Worker بيسمّي السبب وقت السكان.
const SCAN_REPLIES = {
  // نجاح
  '7212244533570': () => ({ ok:true, result:'success', code:'written', machine:'s1', logged:true,
    order:{ orderId:'7212244533570', orderName:'#54727', zone:'Cairo+Giza' },
    valueBefore:null, valueAfter:'Office', warnings:[] }),
  // ملغي — **النص نفسه هو البند**، مش وجود النافذة
  '7212244533575': () => ({ ok:true, result:'rejected', code:'cancelled', machine:null, logged:true,
    order:{ orderId:'7212244533575', orderName:'#54700', zone:'Cairo+Giza' },
    message:'الأوردر ملغي — قطع الشحنة ورجّع المنتجات على الرف' }),
  // خلاص متعمل
  '7212244533576': () => ({ ok:true, result:'already', code:'already_office', machine:'s1', logged:true,
    order:{ orderId:'7212244533576', orderName:'#54690', zone:'Cairo+Giza' },
    message:'الطرد ده في المكتب خلاص — مفيش حاجة كانت مطلوبة' }),
  // حالة شاذة — بتطلب إقرار، وبعد الإقرار بتنجح
  '7212244533578': (body) => body.ack
    ? ({ ok:true, result:'warning', code:'written', machine:'s1', logged:true,
         order:{ orderId:'7212244533578', orderName:'#54999', zone:'Cairo+Giza' },
         valueBefore:'Warehouse', valueAfter:'Office',
         warnings:['الشحنة الأصلية ودورة الاستبدال الاتنين حالتهم Ready'] })
    : ({ ok:true, result:'needs_ack', code:'anomaly', machine:'s1',
         order:{ orderId:'7212244533578', orderName:'#54999', zone:'Cairo+Giza' },
         message:'الأوردر مؤهل، بس فيه حاجة محتاجة مراجعة قبل التسجيل',
         warnings:['الشحنة الأصلية ودورة الاستبدال الاتنين حالتهم Ready'] }),
};

const ORDERS_SINCE = '2026-04-01';

const DIAG = { ok:false, version:'1.1.0', checks:[
  { ok:true,  label:'متغيرات وأسرار الـ Worker', detail:'SHOP_DOMAIN=22 حرف · WORKER_SECRET=40 حرف' },
  { ok:false, label:'تعريف package_whereabouts_s1', detail:'type=single_line_text_field',
    hint:'قيمة «Office» مش في قايمة الاختيار' },
]};

const scanCalls = [];
const logCalls  = [];
function makeStub() {
  return async (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action');
    let body = { ok:true };
    if (action === 'get_config')      body = { ok:true, version:DIAG.version };
    else if (action === 'diag')       body = DIAG;
    else if (action === 'get_employees')
      body = { ok:true, employees:[{ username:'tester', display_name:'الموظف التجريبي' }] };
    // 🔴 **خام** — نفس عقد الـ Worker الحقيقي: `Ready` بس بلا أي فلترة أهلية.
    else if (action === 'get_ready_to_office')
      body = { ok:true, orders:RAW, truncated:false, ordersSince:ORDERS_SINCE,
               fetchedAt:new Date().toISOString() };
    else if (action === 'scan') {
      const b = JSON.parse(route.request().postData() || '{}');
      scanCalls.push(b);
      const digits = String(b.code || '').replace(/\D/g, '');
      const fn = SCAN_REPLIES[digits];
      body = fn ? fn(b)
                : { ok:true, result:'rejected', code:'not_found',
                    message:`مفيش أوردر على شوبيفاي بالرقم ${digits}`, scanned:b.code };
    }
    else if (action === 'get_logs')        { logCalls.push(url.toString()); body = { ok:true, entries:[] }; }
    else if (action === 'get_logs_count')  body = { ok:true, total:0 };
    else if (action === 'get_logs_export') body = { ok:true, entries:[], cap:2000, total:0, truncated:false };
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(body) });
  };
}

// ⚠️ الجلسة بتتزرع بـ `addInitScript` — `requireSession()` بترمي وبتحوّل
//    لـ`index.html` من غير جلسة، فالاختبار كان هيقيس **صفحة الدخول**.
async function newPage({ withSession = true } = {}) {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR_/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript((sess) => {
    // 🔴 مسجّل نغمات — `playBeep` مالهاش أي أثر في الـ DOM، فالاعتراض ده هو
    //    الطريقة الوحيدة لقياسها.
    window.__beeps = [];
    class FakeOsc {
      constructor(){ this.frequency = { setValueAtTime: (f) => window.__beeps.push(f) }; }
      connect(){} start(){} stop(){}
    }
    const fakeCtx = {
      currentTime: 0, destination: {},
      createOscillator: () => new FakeOsc(),
      createGain: () => ({ connect(){}, gain: { setValueAtTime(){}, exponentialRampToValueAtTime(){} } }),
    };
    window.AudioContext = function () { return fakeCtx; };
    try {
      localStorage.setItem('warehouse_ops_worker_secret', 'test-secret-0123456789');
      if (sess) sessionStorage.setItem('woc_session', JSON.stringify(
        { v:1, username:'tester', displayName:'الموظف التجريبي', loginAt:new Date().toISOString() }));
    } catch {}
  }, withSession);
  await page.route('**/*.workers.dev/**', makeStub());
  return { page, ctx, errors };
}

// ⚠️ **§SCAN مالوش `Enter`** — بيشتغل على `input` بمهلة (١٥٠ms للسكانة ·
//    ٤٠٠ms للكتابة اليدوي). `press('Enter')` بيعدّي **بلا أي أثر**،
//    والانتظار لازم يبقى **أطول من المهلة**.
async function scan(page, code) {
  await page.fill('#scanInput', String(code));
  await page.waitForTimeout(900);
}

// ══════════════════════════════════════════════════════════════
// ① الهب — الجلسة والهيدر وحارس النسخة
// ══════════════════════════════════════════════════════════════
console.log('\n══ office-transfer.html ══');
console.log('① الجلسة والهيدر الموحّد');
{
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/office-transfer.html`);
  await page.waitForTimeout(900);

  is(await page.locator('#loginOverlay').count() === 0,
     'مفيش شاشة دخول في الصفحة — الدخول في `index.html` بس');
  is((await page.locator('.app-title-text h1').first().textContent() || '').includes('قسم تسليمات المكتب'),
     'الهيدر الموحّد بعنوان الأداة');
  is(await page.locator('.hbtn-home').count() === 1, 'زرار 🏠 الرئيسية موجود');
  is((await page.locator('.hbtn[aria-label="تسجيل الخروج"]').count()) === 1,
     'زرار الخروج عليه `aria-label` (الـ✕ لوحده مايتقريش عند قارئ الشاشة)');

  const ver = (await page.locator('.hbtn.ver-btn').first().textContent() || '').trim();
  is(/v1\.30\.\d+/.test(ver), 'زرار النسخة بيقول نسخة الهب', ver);
  const clBadge = (await page.locator('#clLatestVerBadge').textContent() || '').trim();
  is(clBadge === ver.replace(/[^v0-9.]/g, ''), 'بادج سجل التحديثات == نسخة الهب', `${clBadge} ≠ ${ver}`);

  is(await page.locator('#aboutWorkers table').count() > 0 ||
     (await page.locator('#aboutWorkers').textContent() || '').includes('قسم تسليمات المكتب'),
     'جدول الـ Workers في «عن الأداة» اتملّى فعلاً');

  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput',
     'الفوكس على مربع السكان من أول لحظة');
  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));
  await ctx.close();
}

{
  const { page, ctx } = await newPage({ withSession:false });
  await page.goto(`${BASE}/office-transfer.html`);
  await page.waitForTimeout(700);
  const u = page.url();
  is(u.includes('index.html') && u.includes('next='),
     'بلا جلسة → تحويل لـ`index.html` بـ`?next=`', u);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ② الطابور — §OFFICE-GATE (أخطر مجموعة في الملف)
// ══════════════════════════════════════════════════════════════
console.log('② الطابور — الفلترة من الـ shell مش من الصفحة');
{
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/office-transfer.html`);
  await page.waitForTimeout(1200);

  const names = await page.$$eval('#rqTableBody tr td:first-child', tds =>
    tds.map(t => t.textContent.trim()));
  is(names.length === ELIGIBLE_NAMES.length && ELIGIBLE_NAMES.every(n => names.some(x => x.includes(n))),
     `الجدول بيعرض المؤهلين بس (${ELIGIBLE_NAMES.length} من ${RAW.length})`, names.join(' · '));

  is(!names.some(n => n.includes('#54777')),
     '🔴 أوردر بوسطة **مستبعَد** — الطرد ده بيتسلّم من المخزن ومابيعدّيش على المكتب');
  is(!names.some(n => n.includes('#54773')), 'اللي ما اتغلّفش مستبعَد');
  is(!names.some(n => n.includes('#54700')), 'الملغي مستبعَد من الطابور');
  is(!names.some(n => n.includes('#54690')), 'اللي في المكتب خلاص مستبعَد');
  is(!names.some(n => n.includes('#54173')),
     '🔴 صف S2 متغلّف على S1 بس **مستبعَد** — الفحص بوقت تغليف S2 مش S1');
  is(names.some(n => n.includes('#54296')),
     'صف S2 المتغلّف فعلاً (وقت تغليف S2 موجود) **ظاهر**');

  const cnt = (await page.locator('#rqCount').textContent() || '').trim();
  const badge = (await page.locator('#rqBadge').textContent() || '').trim();
  is(cnt === String(ELIGIBLE_NAMES.length), 'العدّاد == صفوف الجدول', cnt);
  is(badge === cnt, 'بادج زرار التحديث == العدّاد', `${badge} ≠ ${cnt}`);

  // 🔴 البند اللي بيقفل درس R1: الصفحة بتعدّ من **نفس** دالة الـ shell
  const gateCount = await page.evaluate((raw) => wocOfficeQueue(raw).length, RAW);
  is(gateCount === ELIGIBLE_NAMES.length,
     '`wocOfficeQueue` في الـ shell بترجّع نفس الرقم بالظبط', String(gateCount));

  // ⚠️ بادج الطرد مقصود هنا (بخلاف طابور بوسطة) — باركود الأوردر واحد للطردين
  const s2row = await page.$$eval('#rqTableBody tr', trs =>
    trs.map(tr => tr.textContent).find(t => t.includes('#54296')) || '');
  is(s2row.includes('استبدال'), 'صف S2 عليه بادج «استبدال/استرجاع» — الباركود واحد للطردين');

  is(await page.locator('#rqTableBody input[type=checkbox]').count() === 0,
     'مفيش مربعات اختيار — الطابور عرض بحت');
  is((await page.locator('#rqAgo').textContent() || '') !== 'لسه ما اتحدّثش',
     'لوحة «آخر تحديث» اتملّت بعد الجلب');

  // 🔴 عمود «موقع الشحنة» (v1.30.0) — نفس اسم عمود طابور المرتجعات بالحرف
  const heads = await page.$$eval('#rqTableWrap thead th', ths => ths.map(t => t.textContent.trim()));
  is(heads.includes('موقع الشحنة'),
     '🔴 عمود «موقع الشحنة» موجود — بنفس اسمه في `warehouse-return.html`', heads.join(' | '));
  const cells = await page.$$eval('#rqTableBody tr:first-child td', td => td.length);
  is(cells === heads.length, 'خلايا الصف == أعمدة الهيدر', `${cells} ≠ ${heads.length}`);
  // 🔴 والقيمة جاية من `wocOfficeQueue` — لو السطر اتشال من الـ shell، الخانة
  //    بتقول «مش مسجّل» على **كل** صف حتى اللي عليه `Warehouse` فعلاً، **بلا
  //    أي خطأ في الكونسول**. البند ده بيقفل الحفرة دي بصف عليه القيمة فعلاً.
  const rowTxt = (n) => page.$$eval('#rqTableBody tr', (trs, nm) =>
    (trs.map(t => t.textContent).find(t => t.includes(nm)) || ''), n);
  is((await rowTxt('#54580')).includes('في المخزن'),
     '🔴 الصف اللي عهدته `Warehouse` بيقول «في المخزن» — `whereabouts` بيوصل من الـ shell');
  is((await rowTxt('#54727')).includes('مش مسجّل'),
     '🔴 والعهدة الفاضية «مش مسجّل» مش «في المخزن» — «مش معروف» ≠ «هنا»');

  // 🔴 أرضية تاريخ الأوردر (v1.29.0) — **جاية من الرد مش مكتوبة في الصفحة**
  const subTxt  = (await page.locator('#rqSub').textContent() || '');
  const wantDay = await page.evaluate((d) => wocYmdToDMY(d), ORDERS_SINCE);
  is(subTxt.includes(wantDay),
     '🔴 أرضية تاريخ الأوردر مكتوبة على الشاشة — والتاريخ جاي من رد الـ Worker',
     `${subTxt} ⊅ ${wantDay}`);
  is(wantDay === '01/04/2026',
     '🔴 الأرضية بتتعرض `01/04/2026` — مش بيوم ناقص من تحويل توقيت', String(wantDay));
  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));

  // ⑥ نفس الرقم على الشاشة الرئيسية — من **نفس** الدالة و**نفس** الـ endpoint
  const home = await ctx.newPage();
  await home.route('**/*.workers.dev/**', makeStub());
  await home.addInitScript(() => {
    try {
      localStorage.setItem('warehouse_ops_worker_secret', 'test-secret-0123456789');
      sessionStorage.setItem('woc_session', JSON.stringify(
        { v:1, username:'tester', displayName:'الموظف التجريبي', loginAt:new Date().toISOString() }));
    } catch {}
  });
  await home.goto(`${BASE}/index.html`);
  await home.waitForTimeout(1800);
  const homeCnt = (await home.locator('#cntOffice').textContent() || '').trim();
  is(homeCnt === cnt,
     '🔴 صف الشاشة الرئيسية == قايمة الصفحة بالظبط (درس R1)', `الرئيسية ${homeCnt} · الصفحة ${cnt}`);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ③ السكان — فوري، والنتايج الخمسة
// ══════════════════════════════════════════════════════════════
console.log('③ السكان الفوري');
{
  scanCalls.length = 0;
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/office-transfer.html`);
  await page.waitForTimeout(1200);

  is(await page.locator('button:has-text("إضافة يدوي")').count() === 0,
     'مفيش زرار إدخال يدوي — السكانر هو المدخل الوحيد');
  is(await page.locator('button:has-text("تحديث شوبيفاي")').count() === 0 &&
     await page.locator('#btnUpdate').count() === 0,
     'مفيش زرار تنفيذ — السكان فوري بلا دفعة');

  // ── نجاح ──
  const before = await page.$$eval('#rqTableBody tr', t => t.length);
  await scan(page, '7212244533570');
  is(scanCalls.length === 1 && scanCalls[0].code === '7212244533570',
     'السكانة بعتت نداء `scan` فورًا بلا أي زرار');
  is(scanCalls[0].employee === 'tester', 'اسم الموظف اتبعت في جسم النداء');
  is(await page.locator('#outcomeOverlay.open').count() === 0,
     'النجاح **توست مش نافذة** — النافذة للحالة اللي محتاجة فعل بس');
  const after = await page.$$eval('#rqTableBody tr', t => t.length);
  is(after === before - 1,
     '🔴 الصف اتشال من الطابور بعد النجاح — الشاشة **لازم تتغيّر**', `${before} → ${after}`);
  is((await page.locator('#doneCount').textContent() || '').trim() === '1', 'عدّاد الجلسة اتحرّك');
  is((await page.locator('#sessionBody').textContent() || '').includes('#54727'),
     'صف الجلسة اتضاف باسم الأوردر');

  // ── ملغي: **النص نفسه هو البند** ──
  await scan(page, '7212244533575');
  is(await page.locator('#outcomeOverlay.open').count() === 1, 'الملغي بيفتح نافذة');
  const t1 = await page.locator('#outcomeModal').textContent() || '';
  is(t1.includes('قطع الشحنة') && t1.includes('رجّع المنتجات على الرف'),
     '🔴 نص الرفض بيقول الفعل المطلوب بالحرف', t1.slice(0, 120));
  is(await page.locator('#outcomeModal.fail').count() === 1, 'النافذة حمرا (رفض)');
  // الضغط برّه مايقفلهاش — الموظف بيدوس على الشاشة كتير
  await page.mouse.click(5, 5);
  await page.waitForTimeout(250);
  is(await page.locator('#outcomeOverlay.open').count() === 1, 'الضغط برّه النافذة مايقفلهاش');
  await page.locator('#outcomeFtr button').first().click();
  await page.waitForTimeout(250);
  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput',
     'الفوكس بيرجع لمربع السكان بعد القفل');

  // ── خلاص متعمل: محايد، ومش بيتعدّ فشل ──
  await scan(page, '7212244533576');
  const t2 = await page.locator('#outcomeModal').textContent() || '';
  is(t2.includes('في المكتب خلاص'), 'حالة «خلاص متعمل» بنصّها');
  is(await page.locator('#outcomeModal.fail').count() === 0 &&
     await page.locator('#outcomeModal.warn').count() === 0,
     '🔴 «خلاص متعمل» **محايدة** — لا حمرا ولا صفرا (`constants` §12)');
  const pills = await page.locator('#sessionPills').textContent() || '';
  is(pills.includes('خلاص متعمل'), 'عدّاد مستقل لـ«خلاص متعمل»');
  await page.locator('#outcomeFtr button').first().click();
  await page.waitForTimeout(200);

  // ── حالة شاذة: إقرار قبل الكتابة ──
  scanCalls.length = 0;
  await scan(page, '7212244533578');
  is(scanCalls.length === 1 && scanCalls[0].ack === false,
     'أول نداء للحالة الشاذة بـ`ack:false` — مفيش كتابة');
  const t3 = await page.locator('#outcomeModal').textContent() || '';
  is(t3.includes('محتاج مراجعة') && t3.includes('الاتنين حالتهم Ready'),
     'نافذة التحذير بتعرض التفاصيل بالاسم');
  is(await page.locator('#outcomeFtr button:has-text("سجّل برضه")').count() === 1,
     'زرار «سجّل برضه» موجود');
  await page.locator('#outcomeFtr button:has-text("سجّل برضه")').click();
  await page.waitForTimeout(900);
  is(scanCalls.length === 2 && scanCalls[1].ack === true,
     '🔴 الإقرار بيبعت `ack:true` — الكتابة بعد الإقرار بس');
  is((await page.locator('#sessionBody').textContent() || '').includes('تم بتحذير'),
     'الصف اتسجّل بنتيجة «تم بتحذير»');

  // ── أوردر مش موجود ──
  await scan(page, '9999999999999');
  const t4 = await page.locator('#outcomeModal').textContent() || '';
  is(t4.includes('مفيش أوردر'), 'الأوردر المش موجود بيتقال بالسبب مش بيتجاهل');
  await page.locator('#outcomeFtr button').first().click();

  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ④ النغمات — `playBeep` مالهاش أي أثر في الـ DOM
// ══════════════════════════════════════════════════════════════
console.log('④ نغمات playBeep');
{
  const { page, ctx } = await newPage();
  await page.goto(`${BASE}/office-transfer.html`);
  await page.waitForTimeout(1000);

  await page.evaluate(() => { window.__beeps = []; });
  await scan(page, '7212244533570');
  const okBeeps = await page.evaluate(() => window.__beeps.slice());
  is(okBeeps.includes(880), 'النجاح بيطلّع نغمة `success` (880)', JSON.stringify(okBeeps));

  await page.evaluate(() => { window.__beeps = []; });
  await scan(page, '7212244533575');
  const failBeeps = await page.evaluate(() => window.__beeps.slice());
  is(failBeeps.includes(300) && !failBeeps.includes(880),
     'الرفض بيطلّع نغمة `error` النازلة (300) مش نغمة النجاح', JSON.stringify(failBeeps));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ⑤ تاب السجل + الفحص الذاتي
// ══════════════════════════════════════════════════════════════
console.log('⑤ السجل والفحص الذاتي');
{
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/office-transfer.html`);
  await page.waitForTimeout(900);
  await page.click('#tabLog');
  await page.waitForTimeout(700);

  const heads = await page.$$eval('#panelLog thead th', th => th.map(t => t.textContent.replace(/[^؀-ۿ →]/g,'').trim()));
  is(heads.length === 8, 'جدول السجل ٨ أعمدة', heads.join(' · '));
  const empOpts = await page.locator('#msList-emp .ms-item').count();
  is(empOpts >= 1, 'فلتر الموظف اتملّى من `get_employees`', String(empOpts));
  const typeOpts = await page.locator('#msList-type').textContent() || '';
  is(typeOpts.includes('تسجيل للمكتب') && typeOpts.includes('مرفوض'),
     'فلتر «نوع العملية» بقيم الأداة دي');

  // 🔴 **القيمة المبعوتة هي البند مش الليبل.** الأداة بتكتب تحت سجل
  //    `metafields_change` المشترك بـ`type = 'update'`؛ لو الواجهة فضلت
  //    بتبعت `transfer` (القيمة القديمة) الفلتر بيرجّع **صفر صف** —
  //    والجدول بيقول «لا توجد نتائج» على سجل مليان، **بلا أي خطأ**.
  logCalls.length = 0;
  await page.click('#msBtn-type');
  await page.click('#msList-type .ms-item:has-text("تسجيل للمكتب")');
  await page.waitForTimeout(800);
  const sent = logCalls.map(u => new URL(u).searchParams.get('types')).filter(Boolean);
  is(sent.length > 0 && sent.every(v => v === 'update'),
     '🔴 فلتر «تسجيل للمكتب» بيبعت `types=update` (القيمة المسجّلة) مش `transfer`',
     JSON.stringify(sent));

  // الفحص الذاتي — بيسمّي الـ Worker وبيعرض `hint` تحت الفاشل بس
  await page.click('.hbtn:has-text("الإعدادات")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("فحص")');
  await page.waitForTimeout(900);
  const diagTxt = await page.locator('.settings-overlay').textContent() || '';
  is(diagTxt.includes('قسم تسليمات المكتب'), 'الفحص الذاتي بيسمّي الـ Worker');
  is(diagTxt.includes('قيمة «Office» مش في قايمة الاختيار'),
     '`hint` بيتعرض تحت الفحص الفاشل');
  is(!/test-secret-0123456789/.test(diagTxt), '🔴 صفر قيمة سر في شاشة الفحص');
  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${fail ? '❌' : '✅'} النتيجة: ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
