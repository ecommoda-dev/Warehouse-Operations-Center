// ══════════════════════════════════════════════════════════════
// docs/scanners-check.mjs — فحص متصفح فعلي لـ `shipped.html` و`returned.html`
//
// 🔴 **ليه ملف رابع وما اتضافش لملف قايم؟** نفس قرار `browser-check.mjs`
//    و`sku-barcode-check.mjs` و`pack-check.mjs`: كل ملف بيشغّل Worker وهمي
//    بشكل رد مختلف تمامًا. Worker وهمي واحد بيرد على أربع أدوات معناه إن أول
//    تعديل في رد واحدة بيكسر اختبار التلاتة التانيين.
//
// 🔴 **الصفحتان في ملف واحد هنا عن قصد** — دول نفس الأداة بمسارين
//    (`lookup` → `update`)، نفس عقد الرد بالحرف، ونفس شكل جدول النتايج.
//    فصلهم كان هيكرّر الـ Worker الوهمي كله مرتين.
//
// 🔴 **الملف ده اتكتب عشان دمج v1.22.0**: الأداتين كانوا أدوات مستقلة
//    بشاشة دخول وهيدر وإعدادات وتوست خاصين بيهم، وكله اتشال لصالح
//    `shared/shell.js`. عيلة الفشل المتوقعة هنا **صامتة**: دالة اتشالت
//    وحد لسه بيناديها، أو عنصر (`#loginOverlay`) اتشال وشرط لسه بيقرا منه —
//    الصفحة بتفتح والكونسول نضيف والزرار مايعملش حاجة.
//
// التشغيل:  npm i playwright postcss --no-save && node docs/scanners-check.mjs
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

// ⚠️ Playwright بينزّل نسخته لوحده؛ `PW_CHROMIUM` بيسمح بتمرير مسار كروميوم
//    مثبّت مسبقًا لو التنزيل مش متاح (نفس بند `browser-check.mjs`).
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.PW_CHROMIUM) launchOpts.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launchOpts);

// ══════════════════════════════════════════════════════════════
// الـ Worker الوهمي — الشكل بالحرف زي `index.js` بتاع كل أداة
// ══════════════════════════════════════════════════════════════
//
// ⚠️ **حالة `already` لازم تفضل في الردود دي**: هي ٦ من ٧ صفوف الرفض
//    المسجّلة حيًا، وهي بالظبط اللي `min = 3.4.0` اتحطّ عشانها. لو اتشالت
//    من الـ Worker الوهمي، بند البادج المحايد بيعدّي **وهو مش بيتنفّذ**
//    (نفس درس `includes()` في فحص الباركود).
const SHIPPED_ROWS = [
  { trackingNumber:'11111111', found:true,  valid:true,  orderName:'#53101', orderId:'9001',
    bostaType:'Send', bostaState:'Delivered to consignee', s1:'Ready',   s2:null, target:'S1' },
  { trackingNumber:'22222222', found:true,  valid:false, alreadyDone:true,  orderName:'#53102', orderId:'9002',
    bostaType:'Send', bostaState:'Delivered to consignee', s1:'Shipped', s2:null,
    rejectReason:'الأوردر ده اتشحن خلاص' },
  { trackingNumber:'33333333', found:true,  valid:false, orderName:'#53103', orderId:'9003',
    bostaType:'Send', bostaState:'Created', s1:'New Order', s2:null,
    rejectReason:'S1 ليس Ready (الحالي: New Order)' },
  { trackingNumber:'44444444', found:false, valid:false, error:'الشحنة غير موجودة على بوسطة' },
];

const RETURNED_ROWS = [
  // ⚠️ `machine:'S1'` **مش تفصيلة** — هو اللي بيخلّي الصف يقع في مسار RTO،
  //    ومسار RTO هو اللي بيطلّع سطر «هيتلغي نهائيًا» في نافذة التأكيد.
  //    من غيره الصف بيتقري «استرجاع مخزون» والبند بيعدّي على أخف مسار.
  { trackingNumber:'11111111', found:true,  valid:true,  orderName:'#53201', orderId:'9101', machine:'S1',
    bostaType:'Customer Return Pickup', bostaState:'Returned to business', s1:'Shipped', s2:null,
    returnStatus:null, path:'rto', target:'S1' },
  { trackingNumber:'22222222', found:true,  valid:false, alreadyDone:true, orderName:'#53202', orderId:'9102',
    bostaType:'Customer Return Pickup', bostaState:'Returned to business', s1:'Returned', s2:null,
    rejectReason:'المرتجع ده اتقفل خلاص' },
];

// شكل `checks` بيفرق بين الأداتين — ودي **نقطة الفحص** مش تفصيلة:
//   الشحن  → **مصفوفة** `[{ name, ok, detail, hint }]`
//   المرتجعات → **كائن** بندوده كائنات جوّاها `ok` (الشكل التالت)
const DIAG_SHIPPED = { ok:false, version:'3.4.0', checks:[
  { name:'متغير WORKER_SECRET', ok:true,  detail:'موجود بطول 40' },
  { name:'صلاحيات تطبيق شوبيفاي', ok:false, detail:'ناقص: read_all_orders', hint:'ضِفها في إعدادات الـ Custom App' },
]};
const DIAG_RETURNED = { ok:false, version:'3.4.0', checks:{
  env:         { ok:true,  missing:[], dbBinding:true },
  d1:          { ok:true,  activeEmployees:8 },
  shopifyAuth: { ok:false, error:'فشل الحصول على توكن', hint:'راجع CLIENT_ID و CLIENT_SECRET ثم Promote' },
}};

function makeStub(rows, diag) {
  return async (route) => {
    const url    = new URL(route.request().url());
    const action = url.searchParams.get('action');
    let body = { ok:true };
    if (action === 'get_config')      body = { ok:true, version:'3.4.0' };
    else if (action === 'diag')       body = diag;
    else if (action === 'get_employees')
      body = { ok:true, employees:[{ username:'tester', display_name:'الموظف التجريبي' }] };
    else if (action === 'lookup') {
      const sent = JSON.parse(route.request().postData() || '{}').trackingNumbers || [];
      body = { ok:true, results: rows.filter(r => sent.includes(r.trackingNumber)) };
    }
    else if (action === 'update')     body = { ok:true, results:[], logged:true };
    else if (action === 'get_logs')       body = { ok:true, entries:[], total:0 };
    else if (action === 'get_logs_count') body = { ok:true, count:0, total:0 };
    else if (action === 'get_logs_export')body = { ok:true, entries:[], cap:2000, total:0, truncated:false };
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(body) });
  };
}

// ⚠️ الجلسة بتتزرع بـ `addInitScript` — `requireSession()` بترمي وبتحوّل
//    لـ `index.html` من غير جلسة في `sessionStorage`، فالاختبار كان هيقيس
//    **صفحة الدخول** (نفس بند `pack-check.mjs`).
async function newPage(rows, diag, { withSession = true } = {}) {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR_/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript((sess) => {
    // 🔴 مسجّل نغمات — `playBeep` مالهاش أي أثر في الـ DOM، فالطريقة الوحيدة
    //    لقياسها هي اعتراض `AudioContext` **قبل** ما الصفحة تتحمّل.
    //    البند اللي اتكتب عشانه: `playBeep('scan')` كانت بتقع في الـ `else`
    //    بتاع الـ shell = **نغمة الفشل النازلة على كل سكانة ناجحة**، وصفر
    //    خطأ في الكونسول.
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
  await page.route('**/*.workers.dev/**', makeStub(rows, diag));
  return { page, ctx, errors };
}

// ══════════════════════════════════════════════════════════════
// المجموعة ① — الهب: الجلسة والهيدر والنسخة (الصفحتين)
// ══════════════════════════════════════════════════════════════
for (const [file, title, tabLog, panelLog, rows, diag] of [
  ['shipped.html',  'سكانر الشحن',      '#tabLog',       '#panelLog', SHIPPED_ROWS,  DIAG_SHIPPED],
  ['returned.html', 'سكانر المرتجعات',  '#tabBtnLog',    '#tab-log',  RETURNED_ROWS, DIAG_RETURNED],
]) {
  console.log(`\n══ ${file} ══`);
  console.log('① الجلسة والهيدر الموحّد');
  const { page, ctx, errors } = await newPage(rows, diag);
  await page.goto(`${BASE}/${file}`);
  await page.waitForTimeout(800);

  is(await page.locator('#loginOverlay').count() === 0, '🔴 شاشة الدخول **مش موجودة** في الصفحة — الدخول في الهب');
  is((await page.locator('.app-title-text h1').innerText()).trim() === title, `عنوان الهيدر = «${title}»`);
  is((await page.locator('.app-title-text span').innerText()).includes('مركز عمليات المخزن'), 'العنوان الفرعي بيقول إنها جوّه الهب');
  is(await page.locator('.hbtn-home').count() === 1, '🔴 زرار «🏠 الرئيسية» موجود في المنطقة الوسطى');
  is(await page.locator('#activeUserBtn').getAttribute('aria-label') === 'تسجيل الخروج',
     '🔴 `aria-label="تسجيل الخروج"` على زرار الموظف — الـ ✕ لوحده `aria-hidden`');
  const ver = (await page.locator('#verBtn').innerText()).trim();
  is(ver.startsWith('v1.'), 'زرار النسخة بيقول نسخة **الهب** مش نسخة الأداة القديمة', ver);
  is((await page.locator('#clLatestVerBadge').innerText()).trim() === ver.replace(' 📋',''),
     '🔴 بادج سجل التغييرات == زرار النسخة (مصدر واحد · Standards #24)');
  is(await page.locator('#verStaleBtn').isVisible() === false, 'مفيش تحذير نسخة — الـ Worker الوهمي على الحد الأدنى');
  is(await page.locator('#settingsOverlay').count() === 1, 'نافذة الإعدادات اتحقنت من `wocSharedModals()`');
  is(await page.locator('#toastContainer').count() === 1, 'حاوية التوست اتحقنت من `wocSharedModals()`');

  console.log('② الفحص الذاتي 🩺 — بيسمّي الـ Worker وبيعرض الـ hint');
  await page.click('#settingsBtn'); await page.waitForTimeout(150);
  await page.click('#diagBtn');     await page.waitForTimeout(700);
  const dg = await page.locator('#diagResult').innerHTML();
  is(dg.includes(title), '🔴 نتيجة الفحص بتسمّي الـ Worker بالاسم', dg.slice(0,120));
  is(dg.includes('❌'), 'الفحص الفاشل بيتعرض ❌ مش ℹ️ «معلومة»');
  is(dg.includes('diag-hint'), '🔴 سطر «إزاي تصلّحها» (`hint`) بيتعرض تحت الفحص الفاشل');
  is((dg.match(/diag-hint/g) || []).length === 1, 'و**بس** تحت الفاشل — مش تحت الناجح كمان');
  is(!dg.includes('WORKER_SECRET</span> — <span class="diag-detail">test-secret'),
     '⛔ مفيش قيمة سر في نتيجة الفحص');
  await page.click('.settings-modal-ftr .btn-modal-cancel'); await page.waitForTimeout(150);

  console.log('③ عن الأداة — جدول الـ Workers اتملّى فعلاً');
  await page.click('.hbtn:has-text("عن الأداة")'); await page.waitForTimeout(600);
  const aw = await page.locator('#aboutWorkers').innerHTML();
  is(aw.includes('<table'), 'جدول الـ Workers اتبنى', aw.slice(0,80));
  is(aw.includes(title) && aw.includes('3.4.0'), 'وفيه اسم الـ Worker ونسخته');
  is(!aw.includes('تعذّر الوصول'), 'ومفيش فشل وصول');
  await page.click('#aboutOverlay .modal-close-x'); await page.waitForTimeout(150);

  console.log('④ تاب السجل — فلتر الموظف بيتملّى من `get_employees`');
  await page.click(tabLog); await page.waitForTimeout(600);
  is(await page.locator(panelLog).evaluate(el => el.classList.contains('active')), 'بانل السجل اتفتح');
  is(await page.evaluate(() => msState.emp.items.length) > 0,
     '🔴 فلتر الموظف اتملّى — كان **أثر جانبي لشاشة الدخول** اللي اتشالت');
  is(await page.evaluate(() => msState.emp.items[0].label) === 'الموظف التجريبي',
     'وبالاسم المعروض مش الـ username');

  console.log('— الكونسول —');
  is(errors.length === 0, 'صفر خطأ JS', errors.join(' | ').slice(0,300));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// المجموعة ② — الحارس: بلا جلسة الصفحة بتحوّل للرئيسية
// ══════════════════════════════════════════════════════════════
console.log('\n══ الحارس ══');
console.log('⑤ `requireSession()` بيحوّل للرئيسية');
for (const file of ['shipped.html', 'returned.html']) {
  const { page, ctx } = await newPage(SHIPPED_ROWS, DIAG_SHIPPED, { withSession:false });
  await page.goto(`${BASE}/${file}`);
  await page.waitForTimeout(700);
  const u = new URL(page.url());
  is(u.pathname.endsWith('/index.html'), `${file}: بلا جلسة → تحويل لـ index.html`, page.url());
  is(u.searchParams.get('next') === file, 'و`?next=` بيحمل وجهة الرجوع', u.search);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// المجموعة ③ — مسار السكان الحقيقي (`shipped.html`)
// ══════════════════════════════════════════════════════════════
console.log('\n══ مسار السكان — shipped.html ══');
{
  const { page, ctx, errors } = await newPage(SHIPPED_ROWS, DIAG_SHIPPED);
  await page.goto(`${BASE}/shipped.html`);
  await page.waitForTimeout(700);

  console.log('⑥ الفوكس بيروح لمربع السكان لوحده');
  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput',
     '🔴 الفوكس على `#scanInput` من أول لحظة — السكانر جاهز من غير ضغطة');

  console.log('⑦ إدخال أرقام التتبع + الاستعلام');
  // ⚠️ §SCAN مالوش `Enter` — بيشتغل على `input` بمهلة (١٥٠ms للسكانة ·
  //    ٤٠٠ms للكتابة اليدوي). `fill()` بيطلّق `input` مرة واحدة بالنص
  //    كامل (طوله > ٣) فبياخد مسار السكانة، والانتظار لازم يبقى **أطول
  //    من المهلة**. `press('Enter')` هنا بيعدّي بلا أثر — والاختبار كان
  //    بيقيس لائحة فاضية وهو «بيعدّي» على إدخال ما حصلش.
  for (const tn of ['11111111','22222222','33333333','44444444']) {
    await page.fill('#scanInput', tn);
    await page.waitForTimeout(320);
  }
  is(await page.evaluate(() => scannedNums.length) === 4, 'أربع أرقام دخلت اللائحة');
  await page.click('#btnLookup');
  await page.waitForTimeout(900);
  is(await page.evaluate(() => resultsData.length) === 4, 'الاستعلام رجّع أربع صفوف');

  console.log('⑧ 🔴 حالة `already` محايدة — مش رفض أحمر');
  const already = await page.evaluate(() => {
    const r = resultsData.find(x => x.trackingNumber === '22222222');
    return { alreadyDone: !!r.alreadyDone, valid: !!r.valid, selected: !!r.selected };
  });
  is(already.alreadyDone, '`alreadyDone` وصل من الـ Worker (الحقل اللي `min=3.4.0` اتحط عشانه)');
  is(!already.selected, 'وصف «خلاص اتعمل» **مش متحدد** — مفيش حاجة تتبعت عنه');

  console.log('⑨ 🔴 نغمات `playBeep` — كل نوع له فرع صريح');
  const tones = await page.evaluate(() => {
    const out = {};
    for (const t of ['scan','success','warn','error','__unknown__']) {
      window.__beeps.length = 0; playBeep(t); out[t] = window.__beeps.join(',');
    }
    return out;
  });
  is(tones.scan === '1400', '🔴 `scan` نغمة قصيرة عالية — **مش** نغمة الفشل النازلة', JSON.stringify(tones));
  is(tones.scan !== tones.error, '🔴 و`scan` ≠ `error` — الباج اللي البند ده اتكتب عشانه');
  is(tones.success !== tones.error && tones.warn !== tones.error, 'و`success` و`warn` كل واحد له نغمته');
  is(tones.__unknown__ === tones.error, 'والفرع الافتراضي لسه الفشل — أي قيمة مش معروفة بتتقري «فشل»');

  console.log('⑩ الزرار بيعدّ المتوافق بس');
  const btnTxt = (await page.locator('#btnUpdate').innerText()).replace(/\s+/g,' ');
  is(/1/.test(btnTxt), '🔴 زرار التحديث بيقول **١** — صف واحد بس متوافق من الأربعة', btnTxt);

  console.log('— الكونسول —');
  is(errors.length === 0, 'صفر خطأ JS', errors.join(' | ').slice(0,300));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// المجموعة ④ — نافذة التأكيد قبل الإلغاء (`returned.html`)
// ══════════════════════════════════════════════════════════════
console.log('\n══ التأكيد قبل فعل لا رجعة فيه — returned.html ══');
{
  const { page, ctx, errors } = await newPage(RETURNED_ROWS, DIAG_RETURNED);
  await page.goto(`${BASE}/returned.html`);
  await page.waitForTimeout(700);

  console.log('⑪ الأحمر بقى في اللي بيحذّر — مش في الشاشة كلها');
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  is(accent === '#2563eb', '🔴 `--accent` بقى أزرق الهب — كتلة التوكنز الحمرا اتشالت', accent);
  is(await page.locator('.confirm-modal').count() === 1, 'ونافذة التأكيد لسه موجودة بحدّها الأحمر');

  console.log('⑫ نافذة التأكيد بتقف قدام الإلغاء');
  for (const tn of ['11111111','22222222']) {   // ⚠️ نفس مهلة §SCAN فوق
    await page.fill('#scanInput', tn);
    await page.waitForTimeout(320);
  }
  await page.click('#lookupBtn');
  await page.waitForTimeout(900);
  is(await page.evaluate(() => resultsData.length) === 2, 'الاستعلام رجّع صفّين');
  await page.click('#updateBtn');
  await page.waitForTimeout(500);
  is(await page.locator('#confirmOverlay').evaluate(el => el.classList.contains('open')),
     '🔴 نافذة التأكيد اتفتحت **قبل** أي نداء `update`');
  const ct = await page.locator('#confirmOverlay').innerText();
  is(/هيتلغي نهائيًا/.test(ct), '🔴 والنص بيسمّي الأثر — «هيتلغي نهائيًا» مش «متأكد؟»', ct.replace(/\s+/g,' ').slice(0,140));
  is(/مفيش رجوع فيه/.test(ct), 'وبيقول صراحةً إن الإلغاء مالوش رجعة');
  is(/1/.test(ct), 'وبالعدد — مش جملة عامة');

  console.log('— الكونسول —');
  is(errors.length === 0, 'صفر خطأ JS', errors.join(' | ').slice(0,300));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${fail ? '❌' : '✅'} النتيجة: ${pass} عدّى · ${fail} فشل\n`);
process.exit(fail ? 1 : 0);
