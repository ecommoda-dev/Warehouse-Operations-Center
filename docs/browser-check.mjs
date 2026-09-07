// فحص متصفح فعلي لصفحة الطباعة — `print.html` مع Worker وهمي.
//
// ليه الملف ده موجود: عطلان في `bosta-awb-print` v1.0.0 (مودال الإعدادات
// بيفتح فوق شاشة الدخول · الفوكس بيتسحب جوّه الـ PDF) **ما اتمسكوش بمراجعة
// كود** — اتمسكوا بتشغيل الصفحة في متصفح حقيقي. ونفس الحكاية مع
// `direction:ltr` في `stats.html`.
//
// التشغيل:
//   npm i playwright --no-save
//   node docs/browser-check.mjs
//
// الفحص ده **مع** `docs/css-check.js` وفحص Step 9، مش بديل عنهم.
//
// ⚠️ فخّان في كتابة الاختبار نفسه، الاتنين كلّفوا وقت:
//   ① `frame.evaluate()` على frame فيه PDF **بتعلّق للأبد** في هيدلس —
//      التبليغ من جوّه الصفحة بـ `exposeFunction` بدلها.
//   ② `browser.close()` بتعلّق برضه لو فيه frame PDF مفتوح — سباق بمهلة.

import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';

const ROOT = '/home/user/Warehouse-Operations-Center';
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const srv = http.createServer((req,res)=>{
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'text/plain'});
  res.end(fs.readFileSync(f));
});
await new Promise(r=>srv.listen(0, r));
const PORT = srv.address().port;   // منفذ عشوائي — مفيش تصادم مع تشغيل قديم عالق

// PDF بعدد صفحات محدد — countPdfPages بيدوّر على /Type /Page اللي مش /Pages
const mkPdf = (n) => Buffer.from('%PDF-1.4\n'+'/Type /Page \n'.repeat(n)+'/Type /Pages \ntrailer\n%%EOF').toString('base64');

const ORDERS = [
  {id:'gid://shopify/Order/1', orderId:'1', name:'#53400', createdAt:'2026-09-06T08:00:00Z', customer:'أحمد', type:'S1', status:'Confirmed',        zone:'Other_Regions', zoneKnown:true,  channel:'awb',     total:1200, totalOriginal:1200, printingTimeS1:null, packingTimeS1:null, tags:['Bosta_Uploaded_S1'], isPrinted:false},
  {id:'gid://shopify/Order/2', orderId:'2', name:'#53401', createdAt:'2026-09-06T09:00:00Z', customer:'منى',  type:'S1', status:'Confirmed + Edit', zone:'Other_Regions', zoneKnown:true,  channel:'awb',     total:800,  totalOriginal:800,  printingTimeS1:'2026-09-05T10:00:00Z', packingTimeS1:null, tags:['Bosta_Uploaded_S1'], isPrinted:true},
  {id:'gid://shopify/Order/3', orderId:'3', name:'#53402', createdAt:'2026-09-06T10:00:00Z', customer:'سيد',  type:'S1', status:'Confirmed',        zone:'Other_Regions', zoneKnown:true,  channel:'awb',     total:500,  totalOriginal:500,  printingTimeS1:null, packingTimeS1:null, tags:['Bosta_Uploaded_S1'], isPrinted:false},
  {id:'gid://shopify/Order/4', orderId:'4', name:'#53403', createdAt:'2026-09-06T11:00:00Z', customer:'هدى',  type:'S2', status:'Confirmed + RETURN',zone:'Other_Regions', zoneKnown:true,  channel:'awb',     total:300,  totalOriginal:300,  printingTimeS1:null, packingTimeS1:null, tags:['Bosta_Uploaded_S1'], isPrinted:false},
  {id:'gid://shopify/Order/5', orderId:'5', name:'#53404', createdAt:'2026-09-06T12:00:00Z', customer:'كريم', type:'S1', status:'Confirmed',        zone:'Cairo+Giza',    zoneKnown:true,  channel:'invoice', total:900,  totalOriginal:900,  printingTimeS1:null, packingTimeS1:null, tags:[], isPrinted:false},
  {id:'gid://shopify/Order/6', orderId:'6', name:'#53405', createdAt:'2026-09-06T13:00:00Z', customer:'ندى',  type:'S1', status:'Confirmed',        zone:'Show_Room',     zoneKnown:true,  channel:'invoice', total:400,  totalOriginal:400,  printingTimeS1:null, packingTimeS1:null, tags:[], isPrinted:false},
  {id:'gid://shopify/Order/7', orderId:'7', name:'#53406', createdAt:'2026-09-06T14:00:00Z', customer:'طارق', type:'S1', status:'Confirmed',        zone:null,            zoneKnown:false, channel:null,      total:700,  totalOriginal:700,  printingTimeS1:null, packingTimeS1:null, tags:[], isPrinted:false},
  // 🚚 §BOSTA-GATE — أوردر بوسطة **من غير** تاج الرفع: لسه ما اترفعش على
  //    داشبورد بوسطة، فمستحيل تتطبع بوليصته. لازم يتشال من الجدول ويتعدّ.
  {id:'gid://shopify/Order/9', orderId:'9', name:'#53408', createdAt:'2026-09-06T16:00:00Z', customer:'ياسر', type:'S1', status:'Confirmed',        zone:'Other_Regions', zoneKnown:true,  channel:'awb',     total:550,  totalOriginal:550,  printingTimeS1:null, packingTimeS1:null, tags:[], isPrinted:false},
  {id:'gid://shopify/Order/8', orderId:'8', name:'#53407', createdAt:'2026-09-06T15:00:00Z', customer:'سلمى', type:'S1', status:'Confirmed',        zone:'Cairo',         zoneKnown:false, channel:null,      total:650,  totalOriginal:650,  printingTimeS1:null, packingTimeS1:null, tags:[], isPrinted:false},
];

const calls = [];
// ⚠️ `PW_CHROMIUM` بيسمح بتمرير مسار كروميوم مثبّت مسبقًا لو Playwright
//    ما نزّلش نسخته — نفس اللي في `docs/sku-barcode-check.mjs` بالظبط.
//    مسار مزروع في الكود بيخلّي الاختبار يقع على أي جهاز تاني.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
// أخطاء تحميل موارد خارجية (خط جوجل محجوب بالبروكسي هنا) مش أخطاء كود.
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource/.test(m.text())) errs.push('CONSOLE: '+m.text()); });
page.on('requestfailed', r => { if (!/fonts\.googleapis|fonts\.gstatic|jsdelivr|cdnjs\.cloudflare/.test(r.url())) errs.push('REQFAIL: '+r.url()+' '+r.failure()?.errorText); });

const printHits = [];
await page.exposeFunction('__hit', (k) => { printHits.push(k); });
await page.addInitScript(() => {
  localStorage.setItem('warehouse_ops_worker_secret','x'.repeat(40));
  sessionStorage.setItem('woc_session', JSON.stringify({v:1,username:'Ahmed_Ibraheem',displayName:'Ahmed Ibraheem',loginAt:new Date().toISOString()}));
  // من v1.12.0 البوليصة بتتفتح في **تاب جديد** مش في iframe. الستَب بيرجّع
  // نافذة وهمية عشان الكود يعدّي على المسار الطبيعي (حجز التاب ← توجيهه)،
  // والـ hits بتقول أنهي خطوة اتنفّذت.
  // ⚠️ `window.open` الحقيقية بترجّع `null` لما المتصفح يمنع الـ popup —
  //    والستَب هنا بيرجّع كائن، يعني الشريط الاحتياطي **مالوش أن يظهر**.
  window.print = () => { window.__hit && window.__hit('print'); };
  window.__awbNav = [];
  window.open = (url) => {
    window.__hit && window.__hit(url ? 'open' : 'preopen');
    return {
      closed: false,
      focus() {},
      close() { this.closed = true; },
      document: { write() {}, close() {} },
      location: { replace: (u) => { window.__hit && window.__hit('nav'); window.__awbNav.push(u); } },
    };
  };
});

const J = (o) => ({ status:200, contentType:'application/json', body: JSON.stringify(o) });

await page.route('**order-printer-worker.ecommoda-dev.workers.dev/**', async (route) => {
  const req = route.request(); const url = new URL(req.url());
  const action = url.searchParams.get('action') || '';
  let body = {}; try { body = req.postData() ? JSON.parse(req.postData()) : {}; } catch {}
  calls.push({ path:url.pathname, action, body });

  if (action === 'get_config') return route.fulfill(J({ok:true, version:'2.6.0', tool:'order_printer'}));
  if (url.pathname === '/orders')
    return route.fulfill(J({ok:true, orders:ORDERS, total:ORDERS.length, zoneExcluded:0, allZones:body.allZones===true, fetchedAt:new Date().toISOString()}));
  // مسار الفاتورة بيرجّع خطأ في المجموعة التانية — عشان نختبر **الفشل
  // الجزئي** من غير ما نحاكي فاتورة كاملة بكل حقولها.
  if (url.pathname === '/invoice')
    return route.fulfill({ status:500, contentType:'application/json',
                           body: JSON.stringify({ error:'اختبار: فشل تحضير الفاتورة' }) });
  // `/lookup` — أوردر بعينه مهما كانت حالته (Worker v2.4.0). هنا أوردر
  // **بوسطة** حالته Ready: بيوصل من كارت إعادة الطباعة بس.
  if (url.pathname === '/lookup')
    return route.fulfill(J({ ok:true, inPrintQueue:false, zoneExcluded:1, order:{
      id:'gid://shopify/Order/10', orderId:'10', name:'#53410', createdAt:'2026-09-05T08:00:00Z',
      customer:'ريم', type:'S1', status:'Ready', s1Status:'Ready', s2Status:null,
      printingTimeS1:'2026-09-05T09:00:00Z', packingTimeS1:null, printingTimeS2:null, packingTimeS2:null,
      zone:'Other_Regions', zoneKnown:true, channel:'awb',
      total:1000, totalOriginal:1000, tags:['Printed(S1)'], isPrinted:true } }));
  if (url.pathname === '/logs') return route.fulfill(J({ok:true, entries:[], count:0, total:0, cap:5000, truncated:false}));
  if (action === 'bosta_lookup') {
    const mk = (o) => {
      if (!o) return { id:'gid://shopify/Order/10', name:'#53410', found:true, ok:true, reason:null, codMismatch:null,
             selected:{ deliveryId:'dl10', trackingNumber:'TR10', stateCode:20, stateName:'Route Assigned', type:'Send', cod:1000 }, deliveries:[] };
      if (o.name === '#53402') return { id:o.id, name:o.name, found:false, ok:false, reason:'not_found', selected:null, deliveries:[], codMismatch:null };
      const cod = o.name === '#53400' ? 1500 : o.total;   // #53400 عنده فرق تحصيل
      return { id:o.id, name:o.name, found:true, ok:true, reason:null, codMismatch: cod!==o.total?{cod,total:o.total,diff:cod-o.total}:null,
               selected:{ deliveryId:'dl'+o.orderId, trackingNumber:'TR'+o.orderId, stateCode:20, stateName:'Route Assigned', type:'Send', cod }, deliveries:[] };
    };
    return route.fulfill(J({ ok:true, results:(body.orders||[]).map(b => mk(ORDERS.find(o=>o.id===b.id))), truncated:false, searchLimit:50, logged:true }));
  }
  if (action === 'bosta_awb') {
    const n = (body.deliveryIds||[]).length;
    return route.fulfill(J({ ok:true, status:'success', mode:n>1?'mass':'single', requested:n, pages:n,
      pdfBase64: mkPdf(n), pdfBytes: 1000*n, pdfLooksValid:true, latestAWBPrintDate:null, warnings:[] }));
  }
  // ⚠️ الـ Worker الوهمي **بيفضل يرجّع الأوردر المطبوع في `/orders`** —
  //    ده بالظبط سلوك فهرس بحث شوبيفاي بعد الطباعة على طول (مش فوري).
  //    §JUST-PRINTED هو اللي لازم يشيله من الجدول رغم كده.
  if (url.pathname === '/track')
    return route.fulfill(J({ ok:true, status:'success', actions:['تاج Printed(S1)','وقت الطباعة (printing_time_s1)','الحالة Confirmed → Ready'],
      warnings:[], errors:[], orderId:body.orderId, orderNumber:body.orderNumber, type:body.type, doc:body.doc,
      statusBefore:'Confirmed', statusAfter:'Ready', logged:true }));
  return route.fulfill(J({ ok:true }));
});

let fails = 0;
const check = (name, cond, extra='') => {
  if(!cond) fails++;
  console.log((cond?'✅ ':'❌ ')+name+(cond?'':'  << '+extra));
};

console.log('\n── ① مسار بوسطة ──────────────────────────────');
await page.goto(`http://localhost:${PORT}/print.html`);
await page.waitForSelector('#printDashboard', { state:'visible', timeout:15000 });
await page.waitForTimeout(600);

// ① allZones اتبعت
const ordersCall = calls.find(c => c.path === '/orders');
check('allZones:true اتبعت للـ Worker', ordersCall?.body?.allZones === true, JSON.stringify(ordersCall?.body));

// 🔴 الفلاتر **مطوية افتراضيًا** من v1.12.0 (قرار أحمد 07-09-2026) —
//    الطابور هو الشغل، والفلاتر أداة مساعدة. والطي **مش إخفاء**: ضغطة
//    على الشريط بتفتحه، والفلاتر جوّاه بتفضل شغّالة زي ما هي.
check('🔴 قسم الفلاتر مطوي افتراضيًا (الطباعة)', await page.isHidden('#fltBody-print'));
await page.click('.flt-header'); await page.waitForTimeout(150);
check('🔴 الفلاتر بتتفتح بضغطة على الشريط', await page.isVisible('#fltBody-print'));
await page.click('.flt-header'); await page.waitForTimeout(150);
check('🔴 وبترجع تتطوي بضغطة تانية', await page.isHidden('#fltBody-print'));

// ② عدّادات القنوات
const n = async (k) => (await page.textContent(`#chanN-${k}`)).trim();
check('عدّاد قاهرة+جيزة = 1', await n('invoice')==='1', await n('invoice'));
// 🔴 البادج بيعدّ **المعروض فعلاً** مش القناة كلها: ٥ أوردر بوسطة في الرد،
//    منهم واحد S2 وواحد بلا تاج رفع — فالبادج ٣ زي الجدول بالظبط.
check('🔴 عدّاد بوسطة = 3 (= الجدول، مش القناة كلها)', await n('awb')==='3', await n('awb'));
check('عدّاد شو روم = 1',     await n('showroom')==='1',await n('showroom'));
check('عدّاد بلا قناة = 2',   await n('none')==='2',    await n('none'));
check('زرار «بلا قناة» ظاهر', await page.isVisible('#chanBtn-none'));

// ③ 🔴 مفيش قناة مختارة عند الفتح (v1.13.0) — والجدول بيعرض الكل
//    نفس مربعَي «بوسطة/مناديب» في `pack.html`: مفيش حاجة مولّعة، والفلترة
//    بضغطة. الفرق الإلزامي الوحيد إن الطباعة **مقفولة** لحد ما تتختار قناة.
check('🔴 مفيش قناة مولّعة عند الفتح',
      (await page.$$('#chanBar .chan-btn.active')).length === 0,
      String((await page.$$('#chanBar .chan-btn.active')).length));
// 1 قاهرة+جيزة + 3 بوسطة + 1 شو روم + 2 بلا قناة = 7
check('🔴 الجدول بيعرض كل القنوات (7 صفوف)', (await page.$$('#printTableBody tr')).length === 7,
      String((await page.$$('#printTableBody tr')).length));
{
  const sum = Number(await n('invoice')) + Number(await n('awb')) + Number(await n('showroom')) + Number(await n('none'));
  check('🔴 مجموع البادجات == صفوف الجدول', sum === (await page.$$('#printTableBody tr')).length,
        `sum=${sum} rows=${(await page.$$('#printTableBody tr')).length}`);
}
// 🔴 الطباعة مقفولة بلا قناة — الورق والطابعة بيختلفوا، فالدفعة المختلطة
//    ممنوعة **من أصلها** زي ما كانت بالظبط قبل التغيير.
check('🔴 «طباعة الكل» مقفول بلا قناة', await page.isDisabled('#printAllBtn'));
check('🔴 البادج «—» مش رقم بلا قناة', (await page.textContent('#pbAllCount')).trim() === '—',
      await page.textContent('#pbAllCount'));
check('🔴 سطر «اختر قناة» ظاهر', await page.isVisible('#chanHint'));

// ③-ب الاختيار ثم الإطفاء بنفس المربع (زي `.zchip` في التغليف)
await page.click('#chanBtn-invoice'); await page.waitForTimeout(200);
check('اختيار قاهرة+جيزة بيفلتر لصف واحد', (await page.$$('#printTableBody tr')).length === 1);
check('سطر «اختر قناة» بيختفي بعد الاختيار', await page.isHidden('#chanHint'));
check('«طباعة الكل» اتفعّل بعد اختيار القناة', !(await page.isDisabled('#printAllBtn')));
await page.click('#chanBtn-invoice'); await page.waitForTimeout(200);
check('🔴 ضغطة تانية على نفس المربع بترجّع الكل', (await page.$$('#printTableBody tr')).length === 7,
      String((await page.$$('#printTableBody tr')).length));
check('🔴 والطباعة رجعت مقفولة', await page.isDisabled('#printAllBtn'));

// ④ قناة «بلا قناة» — الصفوف مقفولة
await page.click('#chanBtn-none');
await page.waitForTimeout(200);
const lockedRows = await page.$$('#printTableBody tr.row-locked');
check('صفوف «بلا قناة» ظاهرة ومعلّمة مقفولة', lockedRows.length === 2, String(lockedRows.length));
check('مربعات التحديد متعطّلة', (await page.$$('#printTableBody tr.row-locked input[disabled]')).length === 2);
check('سبب القفل مكتوب في الصف', (await page.textContent('#printTableBody')).includes('الزون لسه ما اتحددش'));
check('قيمة الزون غير المعروفة معروضة زي ما هي', (await page.textContent('#printTableBody')).includes('زون غير معروف: Cairo'));
// 🔴 الشريط الأصفر اتشال في v1.12.0 — فسبب القفل لازم يفضل **في الصف**،
//    وإلا الأوردر بيبان مقفول من غير أي تفسير في أي مكان.
check('🔴 الشريط الأصفر اتشال من الصفحة', (await page.$$('#chanNote')).length === 0);
check('🔴 سبب القفل لسه ظاهر في الصف نفسه', (await page.textContent('#printTableBody')).includes('⚠️'));
check('«طباعة الكل» متعطّل في قناة كلها مقفول', await page.isDisabled('#printAllBtn'));
check('بادج «طباعة الكل» = 0', (await page.textContent('#pbAllCount')).trim() === '0', await page.textContent('#pbAllCount'));
await page.click('#selectAllVisibleBtn'); await page.waitForTimeout(200);
check('«تحديد كل النتائج» مابيحددش المقفول', (await page.textContent('#pbSelCount')).trim() === '0', await page.textContent('#pbSelCount'));

// ⑤ قناة بوسطة — S2 مخفية والعدد معروض
await page.click('#chanBtn-awb');
await page.waitForTimeout(200);
check('صفوف بوسطة = 3 (S2 مخفية)', (await page.$$('#printTableBody tr')).length === 3, String((await page.$$('#printTableBody tr')).length));
// 🚚 §BOSTA-GATE — الأوردر اللي لسه ما اترفعش مستحيل تتطبع بوليصته
check('🚚 الأوردر بلا تاج الرفع مش في الجدول', !(await page.textContent('#printTableBody')).includes('#53408'), '');
check('🚚 أوردر S2 على بوسطة مش في الجدول', !(await page.textContent('#printTableBody')).includes('#53403'), '');
check('عمود القناة بيقول بوسطة', (await page.textContent('#printTableBody')).includes('بوسطة'));
// 🔴 الشريط الأصفر اتشال، فالبادج بقى **المصدر الوحيد** اللي بيقول
//    كام أوردر ينفع يتطبع دلوقتي — والبنود التلاتة تحت بتقفل عليه.
check('🔴 بادج «طباعة الكل» == عدد صفوف الجدول',
      (await page.textContent('#pbAllCount')).trim() === String((await page.$$('#printTableBody tr')).length),
      await page.textContent('#pbAllCount'));
// 🔴 البند ده بيمسك رجوع الباج نفسه: بادج ٦٦ فوق جدول فيه ٦.
check('🔴 البادج == عدد صفوف الجدول', await n('awb') === String((await page.$$('#printTableBody tr')).length),
      `badge=${await n('awb')} rows=${(await page.$$('#printTableBody tr')).length}`);
check('🔴 البادج == عدّاد النتائج', await n('awb') === (await page.textContent('#filteredCount-print')).trim(),
      `badge=${await n('awb')} results=${await page.textContent('#filteredCount-print')}`);

// ⑥ التبديل بيمسح التحديد
await page.click('#selectAllVisibleBtn'); await page.waitForTimeout(200);
check('اتحدد 3 أوردرات بوسطة', (await page.textContent('#pbSelCount')).trim() === '3', await page.textContent('#pbSelCount'));
check('«طباعة المحدد» اتفعّل', !(await page.isDisabled('#printSelectedBtn')));
check('«إلغاء التحديد» اتفعّل', !(await page.isDisabled('#clearSelBtn')));
await page.click('#chanBtn-invoice'); await page.waitForTimeout(200);
check('تبديل القناة مسح التحديد', (await page.textContent('#pbSelCount')).trim() === '0', await page.textContent('#pbSelCount'));
check('«طباعة المحدد» رجع متعطّل بعد المسح', await page.isDisabled('#printSelectedBtn'));

// ⑦ دفعة بوسطة كاملة
await page.click('#chanBtn-awb'); await page.waitForTimeout(200);
await page.click('#selectAllVisibleBtn'); await page.waitForTimeout(200);
await page.click('#printSelectedBtn');
await page.waitForSelector('#gateOverlay.open', { timeout:10000 });
const gate = await page.textContent('#pgBody');
check('البوابة اتفتحت', true);
check('#53400 في البوابة بفرق تحصيل', gate.includes('#53400') && gate.includes('فرق'), '');
check('#53401 في البوابة كفاتورة لاغية', gate.includes('#53401'));
check('#53402 (مش على بوسطة) مش في البوابة', !gate.includes('#53402'));
const boxes = await page.$$('#pgBody [data-gate-need]');
check('عدد مربعات الإقرار = 4 (أوردرين × سؤالين)', boxes.length === 4, String(boxes.length));
check('السؤال التاني بتاع بوسطة موجود', gate.includes('عدّلت الشحنة على بوسطة'));
check('«اطبع الكل» متعطّل قبل الإقرار', await page.isDisabled('#pgPrintAllBtn'));
check('«إلغاء» شغّال دايمًا', !(await page.isDisabled('#pgCancelBtn')));

// علّم مربع واحد بس — لازم يفضل متعطّل (ده اللي بيمسك باج «كل صف» بدل «كل مربع»)
await boxes[0].check(); await page.waitForTimeout(100);
check('مربع واحد مش كفاية — الزرار لسه متعطّل', await page.isDisabled('#pgPrintAllBtn'));
for (const b of boxes) await b.check();
await page.waitForTimeout(150);
check('بعد كل المربعات — الزرار اتفعّل', !(await page.isDisabled('#pgPrintAllBtn')));

await page.click('#pgPrintAllBtn');
await page.waitForSelector('#trackResultOverlay.open', { timeout:15000 });
await page.waitForTimeout(400);

// ⑧ نداءات الـ Worker
const awbCall = calls.filter(c => c.action === 'bosta_awb').pop();
check('bosta_awb اتنادى بـ 2 معرّفات', awbCall?.body?.deliveryIds?.length === 2, JSON.stringify(awbCall?.body));
const tracks = calls.filter(c => c.path === '/track');
check('/track اتنادى مرتين', tracks.length === 2, String(tracks.length));
check('/track بعت type=S1 (الماكينة)', tracks.every(t => t.body.type === 'S1'), JSON.stringify(tracks.map(t=>t.body.type)));
check('/track بعت doc=AWB (المستند)',  tracks.every(t => t.body.doc  === 'AWB'), JSON.stringify(tracks.map(t=>t.body.doc)));
check('/track بعت بيانات الشحنة',      tracks.every(t => t.body.bosta?.trackingNumber), '');
check('الإقرار فيه bostaUpdated',      tracks.every(t => t.body.guard?.bostaUpdated === true), JSON.stringify(tracks.map(t=>t.body.guard)));
check('الإقرار فيه cutConfirmed',      tracks.every(t => t.body.guard?.cutConfirmed === true), '');
check('مفيش أي نداء /invoice في مسار بوسطة', !calls.some(c => c.path === '/invoice'));

// ⑨ نافذة النتيجة
const res = await page.textContent('#trackResultBody');
check('#53402 اتعرض بسبب «ما اترفعش»', res.includes('#53402') && res.includes('ما اترفعش'), '');
check('شارة البوليصة ظاهرة', res.includes('بوليصة'));
// 🔴 §AWB — البوليصة بتتفتح في تاب جديد من v1.12.0. البنود دي بتقفل
//    على **ترتيب** الخطوات: التاب بيتحجز فاضي عند الضغطة (`preopen`)
//    وبيتوجّه للملف بعدين (`nav`). لو الحجز اتأخر لبعد نداءات بوسطة،
//    كروم بيمنع الـ popup في اليوم العادي.
check('🔴 لوحة المعاينة القديمة اتشالت', (await page.$$('#awbPanel')).length === 0);
check('🔴 التاب اتحجز عند الضغطة (قبل نداءات بوسطة)', printHits.includes('preopen'), JSON.stringify(printHits));
check('🔴 التاب اتوجّه للبوليصة', printHits.includes('nav'), JSON.stringify(printHits));
check('🔴 التوجيه لملف blob مش لحاجة تانية',
      await page.evaluate(() => (window.__awbNav||[]).every(u => String(u).startsWith('blob:'))),
      await page.evaluate(() => JSON.stringify(window.__awbNav)));
check('🔴 الشريط الاحتياطي ما ظهرش (التاب اتفتح فعلاً)', !(await page.isVisible('#awbFallback')));
check('🔴 مفيش iframe معاينة للبوليصة', (await page.$$('#awbFrame')).length === 0);


// ⑩ 🔴 §JUST-PRINTED — الأوردر المطبوع بيختفي من الطابور **فورًا**، رغم إن
//    الـ Worker الوهمي لسه بيرجّعه في `/orders` (زي فهرس شوبيفاي بالظبط).
const ordersAfter = calls.filter(c => c.path === '/orders').length;
check('🔴 التحديث اتنادى تلقائيًا بعد الطباعة', ordersAfter >= 2, String(ordersAfter));
await page.click('#trackResultOverlay .btn-primary');   // اقفل نافذة النتيجة
await page.waitForTimeout(400);
const afterBody = await page.textContent('#printTableBody');
check('🔴 #53400 المطبوع اتشال من الطابور', !afterBody.includes('#53400'), afterBody.slice(0,200));
check('🔴 #53401 المطبوع اتشال من الطابور', !afterBody.includes('#53401'), '');
check('🔴 #53402 (ما اتطبعش) لسه في الطابور', afterBody.includes('#53402'), '');
check('🔴 عدّاد بوسطة نزل لـ 1', await n('awb')==='1', await n('awb'));
check('🔴 بادج «طباعة الكل» نزل مع الجدول', (await page.textContent('#pbAllCount')).trim() === '1',
      await page.textContent('#pbAllCount'));

console.log('\n── ② انحدار: مسار الفاتورة (قاهرة+جيزة · شو روم) ──');
await page.reload();
await page.waitForSelector('#printDashboard', { state:'visible', timeout:15000 });
await page.waitForTimeout(400);
calls.length = 0;

// ── انحدار: مسار الفاتورة (قاهرة+جيزة) لسه شغّال زي ما هو ──
// ⚠️ الريلود بيرجّع الصفحة لـ **بلا قناة** (v1.13.0) — فالاختيار صريح هنا.
//    قبل كده كانت بتفتح على قاهرة+جيزة لوحدها.
await page.click('#chanBtn-invoice'); await page.waitForTimeout(200);
check('القناة المختارة = فاتورة قاهرة+جيزة', (await page.getAttribute('#chanBtn-invoice','class')).includes('active'));
await page.click('#selectAllVisibleBtn'); await page.waitForTimeout(200);
check('اتحدد أوردر قاهرة+جيزة واحد', (await page.textContent('#pbSelCount')).trim() === '1', await page.textContent('#pbSelCount'));

await page.click('#printSelectedBtn');
await page.waitForSelector('#trackResultOverlay.open', { timeout:20000 });
await page.waitForTimeout(300);

check('نادى /invoice (مسار الفاتورة) مش bosta_lookup', calls.some(c=>c.path==='/invoice') && !calls.some(c=>c.action==='bosta_lookup'),
      JSON.stringify(calls.map(c=>c.action||c.path)));
check('مفيش نداء bosta_awb في مسار الفاتورة', !calls.some(c=>c.action==='bosta_awb'));
const res2 = await page.textContent('#trackResultBody');
check('الأوردر الفاشل اتعرض بالاسم (فشل جزئي)', res2.includes('#53404'), res2.slice(0,200));
check('البوابة ما اتفتحتش لأوردر نضيف', !(await page.isVisible('#gateOverlay.open')));

// شو روم قناة منفصلة وبتطبع فاتورة برضه
await page.click('#trackResultOverlay .btn-primary'); await page.waitForTimeout(200);
await page.click('#chanBtn-showroom'); await page.waitForTimeout(250);
check('قناة شو روم فيها صف واحد', (await page.$$('#printTableBody tr')).length === 1);
check('عمود القناة بيقول شو روم', (await page.textContent('#printTableBody')).includes('شو روم'));


console.log('\n── ③ إعادة طباعة أوردر بوسطة خرج من الطابور ──');
// 🔴 الفخ اللي البند ده اتكتب عشانه: صف `/lookup` بيعدّي على نفس البوابة
//    ونفس مسار الطباعة. لو `channel` غاب منه، الصف بيتقري «بلا قناة»
//    وأوردر بوسطة بيتطبعله **فاتورة شوبيفاي بدل البوليصة** — من غير أي خطأ.
calls.length = 0;
await page.evaluate(() => openReprintFor('53410', '10'));
await page.waitForSelector('#rpActions', { state:'visible', timeout:10000 });
check('كارت إعادة الطباعة اتفتح', await page.isVisible('#reprintCard.open'));
check('نادى /lookup', calls.some(c => c.path === '/lookup'));

await page.click('#rpPrintBtn');
await page.waitForSelector('#gateOverlay.open', { timeout:10000 });
// الأوردر ده حالته `Ready` وما اتعدّلش، فمفيش إقرار مطلوب — البوابة بتتفتح
// على تنبيه 🟡 «سبق طباعته» بس.
// 🔴 والبند ده بيحرس على حالة **بوابة بلا إقرارات**: زرار «اطبع الكل» لازم
//    يفضل **شغّال**. شرط `boxes.length > 0` في `gateSyncState` كان بيقفله
//    للأبد على كل دفعة سبق طباعتها — اتمسك هنا.
const rpBoxes = await page.$$('#pgBody [data-gate-need]');
check('البوابة فتحت على تنبيه بلا إقرارات', rpBoxes.length === 0, String(rpBoxes.length));
check('«سبق طباعته» ظاهر', (await page.textContent('#pgBody')).includes('سبق طباعتهم'));
check('🔴 «اطبع الكل» شغّال مع بوابة بلا إقرارات', !(await page.isDisabled('#pgPrintAllBtn')));
await page.click('#pgPrintAllBtn');
await page.waitForSelector('#trackResultOverlay.open', { timeout:15000 });
await page.waitForTimeout(300);

check('🔴 نادى bosta_awb — مش /invoice', calls.some(c=>c.action==='bosta_awb') && !calls.some(c=>c.path==='/invoice'),
      JSON.stringify(calls.map(c=>c.action||c.path)));
const rpTrack = calls.filter(c => c.path === '/track');
check('/track بعت doc=AWB في إعادة الطباعة', rpTrack.length===1 && rpTrack[0].body.doc==='AWB',
      JSON.stringify(rpTrack.map(t=>({type:t.body.type,doc:t.body.doc}))));
check('مفيش إقرار متبعت (مفيش فعل مطلوب)', !rpTrack[0]?.body?.guard, JSON.stringify(rpTrack[0]?.body?.guard));

check('صفر أخطاء في الكونسول وصفر أخطاء صفحة', errs.length === 0, errs.join(' | '));

console.log(fails ? `\n❌ ${fails} فحص فشل` : `\n✅ كل الفحوص عدّت`);
// ⚠️ سباق بمهلة — `browser.close()` بتعلّق مع frame فيه PDF.
await Promise.race([browser.close().catch(()=>{}), new Promise(r=>setTimeout(r,4000))]);
srv.close();
process.exit(fails?1:0);
