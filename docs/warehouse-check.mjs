// ══════════════════════════════════════════════════════════════
// docs/warehouse-check.mjs — فحص متصفح فعلي لـ `warehouse-return.html`
//
// 🔴 **ليه ملف سادس؟** نفس قرار الخمسة اللي قبله: كل ملف بيشغّل Worker وهمي
//    بشكل رد **مختلف تمامًا**. الأداة دي عقدها فريد حتى وسط الأدوات الشبيهة:
//    الـ Worker بيرجّع المرتجع/الملغي **خام** والواجهة هي اللي بتفلتر،
//    و**الإلغاء شرط أهلية مش سبب رفض** — وهو عكس `office-check.mjs` بالظبط.
//    Worker وهمي مشترك كان هيخلّي أول تعديل في رد واحدة يكسر اختبار التانية.
//
// 🔴 **وأربع عيلات فشل صامتة الملف ده اتكتب عشانها:**
//    ① شرط أهلية اتكتب في الصفحة بدل الـ shell → الطابور والشاشة الرئيسية
//      بيقولوا رقمين مختلفين، **وصفر خطأ في الكونسول** (درس R1 · v1.11.0).
//    ② 🔴 **حارس الإلغاء اتنسخ من `office-transfer.html`** → الملغي بيترفض،
//      والأداة بترفض **أكبر شريحة عندها** بلا أي رسالة تقول ليه. ودي أخطر
//      واحدة فيهم لأن الكود بيبان سليم تمامًا.
//    ③ صف S2 بيتفحص بوقت تغليف S1 → طرد ما اتغلّفش بيعدّي، **بلا أي رسالة**.
//    ④ الصف مابيتشالش من الطابور بعد النجاح → الشاشة زي ما هي فالموظف بيسكن
//      تاني (٥٩ صف فشل كذّاب في سكانر المرتجعات).
//    أربعتهم **مستحيل يتمسكوا بمراجعة كود** — بيتمسكوا بتشغيل الصفحة فعلاً.
//
// التشغيل:  npm i playwright postcss --no-save && node docs/warehouse-check.mjs
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
// الرد الخام — **زي الـ Worker الحقيقي بالظبط: مرتجع/ملغي بلا أي فلترة**
// ══════════════════════════════════════════════════════════════
//
// 🔴 القايمة دي فيها **مؤهلين وغير مؤهلين مع بعض عن قصد**. ده بالظبط اللي
//    الـ endpoint الحقيقي بيرجّعه، والبند اللي بيتقفل هنا هو إن **الواجهة
//    بتفلتر صح**.
// ⚠️ ومفيش سطر واحد من الفلترة دي مكتوب في `warehouse-return.html` — كله في
//    `shared/shell.js` §WAREHOUSE-GATE، والاختبار بيقارن الاتنين تحت.
const RAW = [
  // ✅ مؤهل — مرتجع راجع من المكتب
  { orderId:'7212244533570', orderName:'#54727', createdAt:'2026-09-02T08:00:00Z',
    cancelledAt:null,
    customer:'أحمد سمير', itemsQty:2, total:'1825.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Returned', s2:null, packedAtS1:'2026-09-04T14:29:48Z', packedAtS2:null,
    packedByS1:'Mohammed Tarek', packedByS2:null, whereaboutsS1:'Office', whereaboutsS2:null },
  // 🔴 ✅ **الصف اللي البند التاني اتكتب عشانه** — ملغي، ولازم يبقى **مؤهل**.
  //    في `office-check.mjs` الصف ده مستبعَد؛ هنا لو اتستبعد فالحارس اتنسخ غلط.
  { orderId:'7212244533571', orderName:'#54580', createdAt:'2026-09-03T08:00:00Z',
    cancelledAt:null,
    customer:'منى فؤاد', itemsQty:1, total:'990.00', zone:'Show_Room', courier:'Showroom',
    s1:'Cancelled', s2:null, packedAtS1:'2026-09-05T09:23:01Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Office', whereaboutsS2:null },
  // ✅ مؤهل — الملغي على شوبيفاي نفسها (`cancelledAt`) والحالة لسه `Confirmed`
  { orderId:'7212244533572', orderName:'#54296', createdAt:'2026-09-06T08:00:00Z',
    cancelledAt:'2026-09-16T12:00:00Z',
    customer:'كريم لطفي', itemsQty:1, total:'1500.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Confirmed', s2:null, packedAtS1:'2026-09-08T06:43:11Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Office', whereaboutsS2:null },
  // ✅ مؤهل — دورة استبدال مرتجعة **ومتغلّفة على S2**
  { orderId:'7212244533573', orderName:'#54301', createdAt:'2026-08-30T08:00:00Z',
    cancelledAt:null,
    customer:'كريمة لطفي', itemsQty:1, total:'1500.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Delivered', s2:'Returned', packedAtS1:'2026-09-01T06:43:11Z', packedAtS2:'2026-09-09T08:20:10Z',
    packedByS1:'Abo Selim', packedByS2:'Marwan Mohammed', whereaboutsS1:null, whereaboutsS2:'Office' },

  // ❌ بوسطة — مرتجعاتها ليها أداتها
  { orderId:'7212244533574', orderName:'#54777', createdAt:'2026-09-10T08:00:00Z',
    cancelledAt:null,
    customer:'سارة محمود', itemsQty:1, total:'700.00', zone:'Other_Regions', courier:'Bosta',
    s1:'Returned', s2:null, packedAtS1:'2026-09-11T10:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // ❌ ما اتغلّفش — ملغي قبل التغليف، يعني **مفيهوش طرد أصلاً**
  { orderId:'7212244533575', orderName:'#54773', createdAt:'2026-09-12T08:00:00Z',
    cancelledAt:null,
    customer:'هبة علي', itemsQty:1, total:'500.00', zone:'Cairo+Giza', courier:null,
    s1:'Cancelled', s2:null, packedAtS1:null, packedAtS2:null,
    packedByS1:null, packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // ❌ في المخزن خلاص
  { orderId:'7212244533576', orderName:'#54690', createdAt:'2026-09-01T08:00:00Z',
    cancelledAt:null,
    customer:'ياسمين رأفت', itemsQty:1, total:'800.00', zone:'Cairo+Giza', courier:null,
    s1:'Returned', s2:null, packedAtS1:'2026-09-03T09:30:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Warehouse', whereaboutsS2:null },
  // 🔴 ❌ **الصف اللي البند التالت اتكتب عشانه**: S2 = Returned ومتغلّف على
  //    **S1 بس**. الفحص بـ`s1_packing_date_time` كان هيعدّيه — والطرد ده
  //    **ما اتغلّفش**.
  { orderId:'7212244533577', orderName:'#54173', createdAt:'2026-08-28T08:00:00Z',
    cancelledAt:null,
    customer:'نهى صبري', itemsQty:1, total:'1200.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Delivered', s2:'Returned', packedAtS1:'2026-09-02T11:06:53Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // 🔴 ❌ **الصفّان اللي الفلتر الجديد اتكتب عشانهم** (قرار أحمد 19-09-2026):
  //    الطابور بيعرض اللي عهدته `Office` **بس**. الاتنين دول **مرتجعان
  //    ومتغلّفان وفي النطاق** — يعني كانوا مؤهلين لحد v1.30.0، والاستبعاد
  //    دلوقتي سببه **العهدة لوحدها**.
  //    ⛔ والاتنين مطلوبين مش واحد: `Courier` بيقفل «قيمة تانية معروفة»،
  //       والفاضي بيقفل **أكبر شريحة في المتجر** (الحقل فاضي على أغلب
  //       الأوردرات لأن أداة التغليف لسه ما بتكتبش `Warehouse`).
  { orderId:'7212244533580', orderName:'#54555', createdAt:'2026-09-05T08:00:00Z',
    cancelledAt:null,
    customer:'وليد نبيل', itemsQty:1, total:'450.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Returned', s2:null, packedAtS1:'2026-09-06T10:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Courier', whereaboutsS2:null },
  { orderId:'7212244533581', orderName:'#54556', createdAt:'2026-09-05T09:00:00Z',
    cancelledAt:null,
    customer:'رانيا حسن', itemsQty:1, total:'380.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Returned', s2:null, packedAtS1:'2026-09-06T11:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // 🔴 ❌ **الصف اللي بيمنع «الطابور فتح على كل حاجة»**: لا مرتجع ولا ملغي.
  //    لو الحالة اتشالت من الشرط، الصف ده بيظهر — والأداة بتبقى بتسجّل رجوع
  //    لطرود لسه **خارجة**.
  { orderId:'7212244533579', orderName:'#54888', createdAt:'2026-09-14T08:00:00Z',
    cancelledAt:null,
    customer:'طارق فهمي', itemsQty:1, total:'640.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Ready', s2:null, packedAtS1:'2026-09-15T10:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Warehouse', whereaboutsS2:null },
];
// 🔴 الترتيب هنا **جزء من البند** — `wocWarehouseQueue` بترتّب بالأقدم
//    **تغليفًا** الأول (زي `wocOfficeQueue` بالحرف). الترتيب بتاريخ الأوردر
//    كان هيدّي ترتيب تاني خالص، و`updatedAt` **اتشال بالكامل** في v1.30.0.
// ⚠️ ولاحظ إن `#54301` بيترتّب بوقت تغليف **S2** مش S1 — الماكينة بتاعته.
const ELIGIBLE_NAMES = ['#54727', '#54580', '#54296', '#54301'];

const SCAN_REPLIES = {
  // نجاح
  '7212244533570': () => ({ ok:true, result:'success', code:'written', machine:'s1', logged:true,
    order:{ orderId:'7212244533570', orderName:'#54727', zone:'Cairo+Giza' },
    valueBefore:'Office', valueAfter:'Warehouse', warnings:[] }),
  // 🔴 **الملغي بينجح** — مش بيترفض. ده عكس `office-check.mjs` بالظبط.
  '7212244533571': () => ({ ok:true, result:'success', code:'written', machine:'s1', logged:true,
    order:{ orderId:'7212244533571', orderName:'#54580', zone:'Show_Room' },
    valueBefore:'Courier', valueAfter:'Warehouse', warnings:[] }),
  // خلاص متعمل
  '7212244533576': () => ({ ok:true, result:'already', code:'already_warehouse', machine:'s1', logged:true,
    order:{ orderId:'7212244533576', orderName:'#54690', zone:'Cairo+Giza' },
    message:'الطرد ده مسجّل في المخزن خلاص — مفيش حاجة كانت مطلوبة' }),
  // بوسطة — **النص نفسه هو البند**، مش وجود النافذة
  '7212244533574': () => ({ ok:true, result:'rejected', code:'bosta', machine:null, logged:true,
    order:{ orderId:'7212244533574', orderName:'#54777', zone:'Other_Regions' },
    message:'الأوردر ده بيتشحن مع بوسطة — مرتجعات بوسطة ليها أداتها' }),
  // ما اتغلّفش — **مفيش طرد يرجع**
  '7212244533575': () => ({ ok:true, result:'rejected', code:'not_packed', machine:'s1', logged:true,
    order:{ orderId:'7212244533575', orderName:'#54773', zone:'Cairo+Giza' },
    message:'الأوردر ده ما اتغلّفش أصلاً — مفيش طرد يرجع، والمنتجات ما خرجتش من مكانها' }),
  // حالة شاذة — بتطلب إقرار، وبعد الإقرار بتنجح
  '7212244533578': (body) => body.ack
    ? ({ ok:true, result:'warning', code:'written', machine:'s1', logged:true,
         order:{ orderId:'7212244533578', orderName:'#54999', zone:'Cairo+Giza' },
         valueBefore:'Office', valueAfter:'Warehouse',
         warnings:['الشحنة الأصلية ودورة الاستبدال/الاسترجاع الاتنين مرتجعين/ملغيين'] })
    : ({ ok:true, result:'needs_ack', code:'anomaly', machine:'s1',
         order:{ orderId:'7212244533578', orderName:'#54999', zone:'Cairo+Giza' },
         message:'الأوردر مؤهل، بس فيه حاجة محتاجة مراجعة قبل التسجيل',
         warnings:['الشحنة الأصلية ودورة الاستبدال/الاسترجاع الاتنين مرتجعين/ملغيين'] }),
};

const DIAG = { ok:false, version:'1.0.0', checks:[
  { ok:true,  label:'متغيرات وأسرار الـ Worker', detail:'SHOP_DOMAIN=22 حرف · WORKER_SECRET=40 حرف' },
  { ok:true,  label:'أرضية تاريخ الأوردر', detail:'الطابور بيعرض أوردرات من 2026-04-01 فأحدث' },
  { ok:false, label:'تعريف package_whereabouts_s1', detail:'type=single_line_text_field',
    hint:'قيمة «Warehouse» مش في قايمة الاختيار' },
]};

const ORDERS_SINCE = '2026-04-01';
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
    // 🔴 **خام** — نفس عقد الـ Worker الحقيقي: مرتجع/ملغي بلا أي فلترة أهلية.
    else if (action === 'get_ready_to_warehouse')
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
    // ⚠️ الشاشة الرئيسية بتنادي أربع endpoints تانية — بترد فاضية عشان
    //    `allSettled` مايخفيش صف المخزن بفشل صف تاني.
    else if (action === 'get_ready_orders')    body = { ok:true, orders:[], total:0 };
    else if (action === 'get_ready_to_ship')   body = { ok:true, orders:[], counts:{ total:0 } };
    else if (action === 'get_ready_to_office') body = { ok:true, orders:[] };
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
console.log('\n══ warehouse-return.html ══');
console.log('① الجلسة والهيدر الموحّد');
{
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/warehouse-return.html`);
  await page.waitForTimeout(900);

  is(await page.locator('#loginOverlay').count() === 0,
     'مفيش شاشة دخول في الصفحة — الدخول في `index.html` بس');
  is((await page.locator('.app-title-text h1').first().textContent() || '').includes('قسم استلام المرتجعات'),
     'الهيدر الموحّد بعنوان الأداة');
  is(await page.locator('.hbtn-home').count() === 1, 'زرار 🏠 الرئيسية موجود');
  is((await page.locator('.hbtn[aria-label="تسجيل الخروج"]').count()) === 1,
     'زرار الخروج عليه `aria-label` (الـ✕ لوحده مايتقريش عند قارئ الشاشة)');

  const ver = (await page.locator('.hbtn.ver-btn').first().textContent() || '').trim();
  is(/v1\.30\.\d+/.test(ver), 'زرار النسخة بيقول نسخة الهب', ver);
  const clBadge = (await page.locator('#clLatestVerBadge').textContent() || '').trim();
  is(clBadge === ver.replace(/[^v0-9.]/g, ''), 'بادج سجل التحديثات == نسخة الهب', `${clBadge} ≠ ${ver}`);

  // 🔴 حارس النسخة لازم يسمّي **الـ Worker بتاع الأداة دي** — الهب بينادي
  //    تمن Workers، ورسالة بلا اسم بتخلّي الموظف يدوّر فيهم كلهم.
  is((await page.locator('#aboutWorkers').textContent() || '').includes('قسم استلام المرتجعات'),
     'جدول الـ Workers في «عن الأداة» اتملّى باسم الأداة');
  is(!(await page.locator('#aboutWorkers').textContent() || '').includes('قسم تسليمات المكتب'),
     '🔴 `PAGE_WORKERS` فيها Worker واحد — مش Worker أداة المكتب كمان');

  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput',
     'الفوكس على مربع السكان من أول لحظة');
  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));
  await ctx.close();
}

{
  const { page, ctx } = await newPage({ withSession:false });
  await page.goto(`${BASE}/warehouse-return.html`);
  await page.waitForTimeout(700);
  const u = page.url();
  is(u.includes('index.html') && u.includes('next='),
     'بلا جلسة → تحويل لـ`index.html` بـ`?next=`', u);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ② الطابور — §WAREHOUSE-GATE (أخطر مجموعة في الملف)
// ══════════════════════════════════════════════════════════════
console.log('② الطابور — الفلترة من الـ shell مش من الصفحة');
{
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/warehouse-return.html`);
  await page.waitForTimeout(1200);

  const names = await page.$$eval('#rqTableBody tr td:first-child', tds =>
    tds.map(t => t.textContent.trim()));
  is(names.length === ELIGIBLE_NAMES.length && ELIGIBLE_NAMES.every(n => names.some(x => x.includes(n))),
     `الجدول بيعرض المؤهلين بس (${ELIGIBLE_NAMES.length} من ${RAW.length})`, names.join(' · '));

  // 🔴🔴 **أهم بند في الملف** — الإلغاء هنا **أهلية** مش رفض
  is(names.some(n => n.includes('#54580')),
     '🔴 الأوردر الملغي **ظاهر في الطابور** — الإلغاء هنا شرط أهلية مش سبب رفض');
  is(names.some(n => n.includes('#54296')),
     '🔴 الملغي على شوبيفاي نفسها (`cancelledAt`) ظاهر كمان — من غير `manual_status = Cancelled`');

  is(!names.some(n => n.includes('#54777')),
     '🔴 مرتجع بوسطة **مستبعَد** — مرتجعاتها ليها أداتها');
  is(!names.some(n => n.includes('#54773')),
     'الملغي اللي ما اتغلّفش مستبعَد — مفيش طرد يرجع أصلاً');
  is(!names.some(n => n.includes('#54690')), 'اللي في المخزن خلاص مستبعَد');
  is(!names.some(n => n.includes('#54173')),
     '🔴 صف S2 متغلّف على S1 بس **مستبعَد** — الفحص بوقت تغليف S2 مش S1');
  is(!names.some(n => n.includes('#54888')),
     '🔴 أوردر `Ready` (لا مرتجع ولا ملغي) **مستبعَد** — الأداة مابتسجّلش رجوع لطرد خارج');
  is(names.some(n => n.includes('#54301')),
     'صف S2 المرتجع والمتغلّف فعلاً (وقت تغليف S2 موجود) **ظاهر**');

  // 🔴🔴 **الفلتر الجديد (v1.30.0)** — الطابور بيعرض عهدة `Office` **بس**
  is(!names.some(n => n.includes('#54555')),
     '🔴 المرتجع اللي عهدته `Courier` **مستبعَد** — الطابور بيعرض اللي في المكتب بس');
  is(!names.some(n => n.includes('#54556')),
     '🔴 والمرتجع اللي عهدته **فاضية** مستبعَد كمان — «مش عارفين كان فين» مش طابور شغل');
  // ⚠️ والصفّان دول **مؤهلان في الـ Worker** — الفلتر عرض بس، والسكانة شغّالة
  //    عليهم. البند ده بيقرا البوابة مباشرةً عشان يثبت السبب مش النتيجة.
  const whyCourier = await page.evaluate((raw) =>
    wocWarehouseGate(raw.find(o => o.orderName === '#54555')).code, RAW);
  is(whyCourier === 'not_in_office',
     '🔴 وسبب الاستبعاد `not_in_office` — مش `status` ولا `not_packed`', String(whyCourier));

  // 🔴 الترتيب جزء من العقد — الأقدم **تغليفًا** الأول
  is(names[0].includes('#54727') && names[names.length - 1].includes('#54301'),
     '🔴 الترتيب بالأقدم تغليفًا الأول — نفس ترتيب طابور المكتب بالحرف',
     names.join(' · '));

  const cnt = (await page.locator('#rqCount').textContent() || '').trim();
  const badge = (await page.locator('#rqBadge').textContent() || '').trim();
  is(cnt === String(ELIGIBLE_NAMES.length), 'العدّاد == صفوف الجدول', cnt);
  is(badge === cnt, 'بادج زرار التحديث == العدّاد', `${badge} ≠ ${cnt}`);

  // 🔴 البند اللي بيقفل درس R1: الصفحة بتعدّ من **نفس** دالة الـ shell
  const gateCount = await page.evaluate((raw) => wocWarehouseQueue(raw).length, RAW);
  is(gateCount === ELIGIBLE_NAMES.length,
     '`wocWarehouseQueue` في الـ shell بترجّع نفس الرقم بالظبط', String(gateCount));

  // 🔴 **والبوابتان مختلفتان فعلاً** — لو حد وحّدهم، الملغي هيختفي من هنا
  const officeCount = await page.evaluate((raw) => wocOfficeQueue(raw).length, RAW);
  is(officeCount !== gateCount,
     '🔴 `wocOfficeQueue` بترجّع رقم مختلف على نفس البيانات — البوابتان مش نسخة واحدة',
     `office ${officeCount} · warehouse ${gateCount}`);

  // عمود «الحالة» — السبب اللي الأوردر في القايمة عشانه
  const rowTxt = (n) => page.$$eval('#rqTableBody tr', (trs, nm) =>
    (trs.map(t => t.textContent).find(t => t.includes(nm)) || ''), n);
  const rowsTxt = await page.$$eval('#rqTableBody tr', trs => trs.map(t => t.textContent));
  is((await rowTxt('#54727')).includes('مرتجع'), 'صف المرتجع عليه بادج «مرتجع»');
  is((await rowTxt('#54580')).includes('ملغي'),  'صف الملغي عليه بادج «ملغي» — مش نفس البادج');
  is((await rowTxt('#54301')).includes('استبدال'),
     'صف S2 عليه «استبدال» — باركود الأوردر واحد للطردين فالتفرقة لازم تتقال');

  // عمود «موقع الشحنة» — العهدة قبل السكانة
  is((await rowTxt('#54727')).includes('في المكتب'), 'عمود العهدة بيقول «في المكتب» للراجع من المكتب');
  is(!rowsTxt.some(t => t.includes('مش مسجّل') || t.includes('مع المندوب')),
     '🔴 صفر صف بعهدة غير «في المكتب» — الفلتر بيشتغل على القيمة مش على وجودها',
     rowsTxt.join(' | ').slice(0, 300));

  // 🔴 **أعمدة الجدول** — الاسم الموحّد، و`updatedAt` اتشال بالكامل (v1.30.0)
  const heads = await page.$$eval('#rqTableWrap thead th', ths => ths.map(t => t.textContent.trim()));
  is(heads.includes('موقع الشحنة'),
     '🔴 العمود اسمه «موقع الشحنة» — نفس اسمه في طابور المكتب بالحرف', heads.join(' | '));
  is(!heads.some(h => h.includes('آخر تحديث')),
     '🔴 مفيش عمود «آخر تحديث» ولا «الوقت منذ آخر تحديث» — `updatedAt` كان تقريب بيتقري تسجيل',
     heads.join(' | '));
  is(!heads.includes('الطرد فين دلوقتي'), 'والاسم القديم اتشال خالص', heads.join(' | '));
  const cells = await page.$$eval('#rqTableBody tr:first-child td', td => td.length);
  is(cells === heads.length, 'خلايا الصف == أعمدة الهيدر', `${cells} ≠ ${heads.length}`);
  // ⛔ ولا أثر لـ`updatedAt` في الصفحة نفسها
  const pageSrc = await page.content();
  is(!/data-rq-upd|rqSinceUpdate/.test(pageSrc),
     '🔴 صفر أثر لـ`rqSinceUpdate`/`data-rq-upd` في الصفحة');

  // النافذة الزمنية بتتقال على الشاشة، وجاية من الرد مش مكتوبة بالإيد
  // 🔴 **الأرضية مكتوبة على الشاشة وجاية من الرد** — لو الصفحة كتبتها
  //    بالإيد، تغيير الأرضية في الـ Worker بيسيب الشاشة بتقول القديم
  //    **في صمت** (درس R1).
  // ⚠️ والمقارنة بنص `wocYmdToDMY` **المحسوب في الصفحة** مش بنص مكتوب هنا.
  const subTxt  = (await page.locator('#rqSub').textContent() || '');
  const wantDay = await page.evaluate((d) => wocYmdToDMY(d), ORDERS_SINCE);
  is(subTxt.includes(wantDay),
     '🔴 أرضية تاريخ الأوردر مكتوبة على الشاشة — والتاريخ جاي من رد الـ Worker',
     `${subTxt} ⊅ ${wantDay}`);
  is(subTxt.includes('في المكتب'),
     '🔴 السطر تحت العنوان بيسمّي شرط القايمة — «مسجّل إنه في المكتب»', subTxt);
  is(wantDay === '01/04/2026',
     '🔴 الأرضية بتتعرض `01/04/2026` — مش بيوم ناقص من تحويل توقيت', String(wantDay));
  is(!/يوم|آخر ٣٠|آخر 30/.test(subTxt),
     '🔴 صفر أثر للنافذة المتحرّكة القديمة في السطر — الأرضية ثابتة مش «آخر N يوم»', subTxt);

  is(await page.locator('#rqTableBody input[type=checkbox]').count() === 0,
     'مفيش مربعات اختيار — الطابور عرض بحت');
  is((await page.locator('#rqAgo').textContent() || '') !== 'لسه ما اتحدّثش',
     'لوحة «آخر تحديث» اتملّت بعد الجلب');
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
  await home.waitForTimeout(2200);
  const homeCnt = (await home.locator('#cntWarehouse').textContent() || '').trim();
  is(homeCnt === cnt,
     '🔴 صف الشاشة الرئيسية == قايمة الصفحة بالظبط (درس R1)', `الرئيسية ${homeCnt} · الصفحة ${cnt}`);
  // 🔴 البند اللي مسك عطل حقيقي في v1.26.0: `loadCounts` بقايمة مكتوبة بالإيد
  is(homeCnt !== '—',
     '🔴 صف المخزن اتجاب فعلاً — `loadCounts` بتتبني من `Object.keys(homeQ)` مش قايمة بالإيد');
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ③ السكان — فوري، والنتايج
// ══════════════════════════════════════════════════════════════
console.log('③ السكان الفوري');
{
  scanCalls.length = 0;
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/warehouse-return.html`);
  await page.waitForTimeout(1200);

  is(await page.locator('button:has-text("إضافة يدوي")').count() === 0,
     'مفيش زرار إدخال يدوي — السكانر هو المدخل الوحيد');
  is(await page.locator('#btnUpdate').count() === 0,
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

  // ── 🔴 الملغي **بينجح** — عكس أداة المكتب ──
  const before2 = await page.$$eval('#rqTableBody tr', t => t.length);
  await scan(page, '7212244533571');
  is(await page.locator('#outcomeOverlay.open').count() === 0,
     '🔴 سكان الأوردر الملغي **نجاح بتوست** — مفيش نافذة رفض زي أداة المكتب');
  is(await page.$$eval('#rqTableBody tr', t => t.length) === before2 - 1,
     'وصف الملغي اتشال من الطابور بعد النجاح');

  // ── بوسطة: **النص نفسه هو البند** ──
  await scan(page, '7212244533574');
  is(await page.locator('#outcomeOverlay.open').count() === 1, 'مرتجع بوسطة بيفتح نافذة رفض');
  const t1 = await page.locator('#outcomeModal').textContent() || '';
  is(t1.includes('قسم مرتجعات بوسطة'),
     '🔴 نص الرفض بيوجّه لأداة بوسطة بالاسم — مش بيقول «مرفوض» وخلاص', t1.slice(0, 140));
  is(await page.locator('#outcomeModal.fail').count() === 1, 'النافذة حمرا (رفض)');
  await page.mouse.click(5, 5);
  await page.waitForTimeout(250);
  is(await page.locator('#outcomeOverlay.open').count() === 1, 'الضغط برّه النافذة مايقفلهاش');
  await page.locator('#outcomeFtr button').first().click();
  await page.waitForTimeout(250);
  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput',
     'الفوكس بيرجع لمربع السكان بعد القفل');

  // ── ما اتغلّفش — **مفيش طرد يرجع** ──
  await scan(page, '7212244533575');
  const t2 = await page.locator('#outcomeModal').textContent() || '';
  is(t2.includes('ما اتغلّفش') && t2.includes('مفيش طرد يرجع'),
     '🔴 رفض «ما اتغلّفش» بيقول إن مفيش طرد أصلاً — مش «الأوردر مش مؤهل»', t2.slice(0, 140));
  await page.locator('#outcomeFtr button').first().click();
  await page.waitForTimeout(200);

  // ── خلاص متعمل: محايد، ومش بيتعدّ فشل ──
  await scan(page, '7212244533576');
  const t3 = await page.locator('#outcomeModal').textContent() || '';
  is(t3.includes('في المخزن خلاص'), 'حالة «خلاص متعمل» بنصّها');
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
  const t4 = await page.locator('#outcomeModal').textContent() || '';
  is(t4.includes('محتاج مراجعة') && t4.includes('مرتجعين/ملغيين'),
     'نافذة التحذير بتعرض التفاصيل بالاسم');
  await page.locator('#outcomeFtr button:has-text("سجّل برضه")').click();
  await page.waitForTimeout(900);
  is(scanCalls.length === 2 && scanCalls[1].ack === true,
     '🔴 الإقرار بيبعت `ack:true` — الكتابة بعد الإقرار بس');
  is((await page.locator('#sessionBody').textContent() || '').includes('تم بتحذير'),
     'الصف اتسجّل بنتيجة «تم بتحذير»');

  // ── أوردر مش موجود ──
  await scan(page, '9999999999999');
  const t5 = await page.locator('#outcomeModal').textContent() || '';
  is(t5.includes('مفيش أوردر'), 'الأوردر المش موجود بيتقال بالسبب مش بيتجاهل');
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
  await page.goto(`${BASE}/warehouse-return.html`);
  await page.waitForTimeout(1000);

  await page.evaluate(() => { window.__beeps = []; });
  await scan(page, '7212244533570');
  const okBeeps = await page.evaluate(() => window.__beeps.slice());
  is(okBeeps.includes(880), 'النجاح بيطلّع نغمة `success` (880)', JSON.stringify(okBeeps));

  await page.evaluate(() => { window.__beeps = []; });
  await scan(page, '7212244533574');
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
  await page.goto(`${BASE}/warehouse-return.html`);
  await page.waitForTimeout(900);
  await page.click('#tabLog');
  await page.waitForTimeout(700);

  const heads = await page.$$eval('#panelLog thead th', th => th.map(t => t.textContent.replace(/[^؀-ۿ →]/g,'').trim()));
  is(heads.length === 8, 'جدول السجل ٨ أعمدة', heads.join(' · '));
  const empOpts = await page.locator('#msList-emp .ms-item').count();
  is(empOpts >= 1, 'فلتر الموظف اتملّى من `get_employees`', String(empOpts));
  const typeOpts = await page.locator('#msList-type').textContent() || '';
  is(typeOpts.includes('تسجيل رجوع للمخزن') && typeOpts.includes('مرفوض'),
     'فلتر «نوع العملية» بقيم الأداة دي');

  // 🔴 **القيمة المبعوتة هي البند مش الليبل.** الأداة بتكتب تحت سجل
  //    `metafields_change` المشترك بـ`type = 'update'`؛ أي قيمة تانية بترجّع
  //    **صفر صف** والجدول بيقول «لا توجد نتائج» على سجل مليان، بلا أي خطأ.
  logCalls.length = 0;
  await page.click('#msBtn-type');
  await page.click('#msList-type .ms-item:has-text("تسجيل رجوع للمخزن")');
  await page.waitForTimeout(800);
  const sent = logCalls.map(u => new URL(u).searchParams.get('types')).filter(Boolean);
  is(sent.length > 0 && sent.every(v => v === 'update'),
     '🔴 فلتر «تسجيل رجوع للمخزن» بيبعت `types=update` (القيمة المسجّلة)',
     JSON.stringify(sent));

  // الفحص الذاتي — بيسمّي الـ Worker وبيعرض `hint` تحت الفاشل بس
  await page.click('.hbtn:has-text("الإعدادات")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("فحص")');
  await page.waitForTimeout(900);
  const diagTxt = await page.locator('.settings-overlay').textContent() || '';
  is(diagTxt.includes('قسم استلام المرتجعات'), 'الفحص الذاتي بيسمّي الـ Worker');
  is(diagTxt.includes('قيمة «Warehouse» مش في قايمة الاختيار'),
     '`hint` بيتعرض تحت الفحص الفاشل');
  is(diagTxt.includes('2026-04-01'),
     'الفحص الذاتي بيقول أرضية تاريخ الأوردر بالتاريخ');
  is(!/test-secret-0123456789/.test(diagTxt), '🔴 صفر قيمة سر في شاشة الفحص');
  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${fail ? '❌' : '✅'} النتيجة: ${pass} عدّى · ${fail} فشل`);
process.exit(fail ? 1 : 0);
