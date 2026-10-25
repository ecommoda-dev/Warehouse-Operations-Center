// ══════════════════════════════════════════════════════════════
// docs/warehouse-check.mjs — فحص متصفح فعلي لـ `Package-Transfer-To-Warehouse.html`
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
//    ② 🔴 **حارس الإلغاء اتنسخ من `Package-Transfer-To-Office.html`** → الملغي بيترفض،
//      والأداة بترفض **أكبر شريحة عندها** بلا أي رسالة تقول ليه. ودي أخطر
//      واحدة فيهم لأن الكود بيبان سليم تمامًا.
//    ③ صف S2 بيتفحص بوقت تغليف S2 → **الاسترجاع الخالص** (مفيش طرد S2 اتغلّف)
//      بيترفض ومش بيظهر في الطابور، **بلا أي رسالة تقول ليه** (v1.52.0 · `#53764`).
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
// ⚠️ ومفيش سطر واحد من الفلترة دي مكتوب في `Package-Transfer-To-Warehouse.html` — كله في
//    `shared/shell.js` §WAREHOUSE-GATE، والاختبار بيقارن الاتنين تحت.
const RAW = [
  // ✅ مؤهل — مرتجع راجع من المكتب
  { orderId:'7212244533570', orderName:'#54727', createdAt:'2026-09-02T08:00:00Z',
    cancelledAt:null,
    address:'12 شارع التحرير، الدقي، الجيزة', itemsQty:2, total:'1825.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Returned', s2:null, packedAtS1:'2026-09-04T14:29:48Z', packedAtS2:null,
    packedByS1:'Mohammed Tarek', packedByS2:null, whereaboutsS1:'Office', whereaboutsS2:null },
  // 🔴 ✅ **الصف اللي البند التاني اتكتب عشانه** — ملغي، ولازم يبقى **مؤهل**.
  //    في `office-check.mjs` الصف ده مستبعَد؛ هنا لو اتستبعد فالحارس اتنسخ غلط.
  { orderId:'7212244533571', orderName:'#54580', createdAt:'2026-09-03T08:00:00Z',
    cancelledAt:null,
    address:'5 شارع الهرم، الجيزة', itemsQty:1, total:'990.00', zone:'Show_Room', courier:'Showroom',
    s1:'Cancelled', s2:null, packedAtS1:'2026-09-05T09:23:01Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Office', whereaboutsS2:null },
  // ✅ مؤهل — الملغي على شوبيفاي نفسها (`cancelledAt`) والحالة لسه `Confirmed`
  { orderId:'7212244533572', orderName:'#54296', createdAt:'2026-09-06T08:00:00Z',
    cancelledAt:'2026-09-16T12:00:00Z',
    address:'7 شارع النصر، مدينة نصر، القاهرة', itemsQty:1, total:'1500.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Confirmed', s2:null, packedAtS1:'2026-09-08T06:43:11Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Office', whereaboutsS2:null },
  // ✅ مؤهل — دورة استبدال مرتجعة (الطرد الراجع = الشحنة الأصلية المتغلّفة على S1)
  { orderId:'7212244533573', orderName:'#54301', createdAt:'2026-08-30T08:00:00Z',
    cancelledAt:null,
    address:'20 شارع عباس العقاد، مدينة نصر، القاهرة', itemsQty:1, total:'1500.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Delivered', s2:'Returned', s2Cycle:'exchange', packedAtS1:'2026-09-01T06:43:11Z', packedAtS2:'2026-09-09T08:20:10Z',
    packedByS1:'Abo Selim', packedByS2:'Marwan Mohammed', whereaboutsS1:null, whereaboutsS2:'Office' },

  // ❌ بوسطة — مرتجعاتها ليها أداتها
  { orderId:'7212244533574', orderName:'#54777', createdAt:'2026-09-10T08:00:00Z',
    cancelledAt:null,
    address:'1 شارع بورسعيد، العبور', itemsQty:1, total:'700.00', zone:'Other_Regions', courier:'Bosta',
    s1:'Returned', s2:null, packedAtS1:'2026-09-11T10:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // ❌ ما اتغلّفش — ملغي قبل التغليف، يعني **مفيهوش طرد أصلاً**
  { orderId:'7212244533575', orderName:'#54773', createdAt:'2026-09-12T08:00:00Z',
    cancelledAt:null,
    address:'3 شارع فيصل، الجيزة', itemsQty:1, total:'500.00', zone:'Cairo+Giza', courier:null,
    s1:'Cancelled', s2:null, packedAtS1:null, packedAtS2:null,
    packedByS1:null, packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // ❌ في المخزن خلاص
  { orderId:'7212244533576', orderName:'#54690', createdAt:'2026-09-01T08:00:00Z',
    cancelledAt:null,
    address:'9 شارع جامعة الدول، المهندسين، الجيزة', itemsQty:1, total:'800.00', zone:'Cairo+Giza', courier:null,
    s1:'Returned', s2:null, packedAtS1:'2026-09-03T09:30:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Warehouse', whereaboutsS2:null },
  // 🔴 ✅ **الصف اللي البند التالت اتكتب عشانه (v1.52.0 · `#53764`)**: **استرجاع
  //    خالص** — S2 = Returned ومتغلّف على **S1 بس** ومفيش طرد S2 اتغلّف أصلاً.
  //    الطرد الراجع هو الشحنة الأصلية، فلازم يبقى **مؤهل**. (كان مستبعَد لحد
  //    v1.51.0 بفحص `s2_packing_date_time` — وده اللي كان بيرفض كل استرجاع.)
  { orderId:'7212244533577', orderName:'#54173', createdAt:'2026-08-28T08:00:00Z',
    cancelledAt:null,
    address:'15 شارع مصطفى النحاس، القاهرة', itemsQty:1, total:'1200.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Delivered', s2:'Returned', s2Cycle:'return', packedAtS1:'2026-09-02T11:06:53Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:'Office' },
  // ✅ مؤهل — S2 **نوعه مش معروف** (`s2Cycle: null` — Worker قديم أو `read_returns` ناقصة): لازم يتعرض «استبدال/استرجاع» مش تخمين
  { orderId:'7212244533591', orderName:'#54175', createdAt:'2026-08-26T08:00:00Z',
    cancelledAt:null,
    address:'11 شارع الهرم، الجيزة', itemsQty:1, total:'600.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Delivered', s2:'Returned', s2Cycle:null, packedAtS1:'2026-09-12T11:06:53Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:'Office' },
  // 🔴 ❌ **وده الوش التاني للشرط**: S2 = Returned **والشحنة الأصلية نفسها ما
  //    اتغلّفتش** (مفيش `s1_packing_date_time`) — مفيش طرد يرجع أصلاً.
  { orderId:'7212244533590', orderName:'#54174', createdAt:'2026-08-27T08:00:00Z',
    cancelledAt:null,
    address:'2 شارع الحجاز، مصر الجديدة، القاهرة', itemsQty:1, total:'900.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Delivered', s2:'Returned', packedAtS1:null, packedAtS2:'2026-09-02T11:06:53Z',
    packedByS1:null, packedByS2:'Abo Selim', whereaboutsS1:null, whereaboutsS2:'Office' },
  // 🔴 ❌ **الصفّان اللي الفلتر الجديد اتكتب عشانهم** (قرار أحمد 19-09-2026):
  //    الطابور بيعرض اللي عهدته `Office` **بس**. الاتنين دول **مرتجعان
  //    ومتغلّفان وفي النطاق** — يعني كانوا مؤهلين لحد v1.30.0، والاستبعاد
  //    دلوقتي سببه **العهدة لوحدها**.
  //    ⛔ والاتنين مطلوبين مش واحد: `Courier` بيقفل «قيمة تانية معروفة»،
  //       والفاضي بيقفل **أكبر شريحة في المتجر** (الحقل فاضي على أغلب
  //       الأوردرات لأن أداة التغليف لسه ما بتكتبش `Warehouse`).
  { orderId:'7212244533580', orderName:'#54555', createdAt:'2026-09-05T08:00:00Z',
    cancelledAt:null,
    address:'8 شارع الثورة، القاهرة', itemsQty:1, total:'450.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Returned', s2:null, packedAtS1:'2026-09-06T10:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Courier', whereaboutsS2:null },
  { orderId:'7212244533581', orderName:'#54556', createdAt:'2026-09-05T09:00:00Z',
    cancelledAt:null,
    address:'4 شارع الملك فيصل، الجيزة', itemsQty:1, total:'380.00', zone:'Cairo+Giza', courier:'Sobhy',
    s1:'Returned', s2:null, packedAtS1:'2026-09-06T11:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:null, whereaboutsS2:null },
  // 🔴 ❌ **الصف اللي بيمنع «الطابور فتح على كل حاجة»**: لا مرتجع ولا ملغي.
  //    لو الحالة اتشالت من الشرط، الصف ده بيظهر — والأداة بتبقى بتسجّل رجوع
  //    لطرود لسه **خارجة**.
  { orderId:'7212244533579', orderName:'#54888', createdAt:'2026-09-14T08:00:00Z',
    cancelledAt:null,
    address:'6 شارع الجيش، القاهرة', itemsQty:1, total:'640.00', zone:'Cairo+Giza', courier:'Saif',
    s1:'Ready', s2:null, packedAtS1:'2026-09-15T10:00:00Z', packedAtS2:null,
    packedByS1:'Abo Selim', packedByS2:null, whereaboutsS1:'Warehouse', whereaboutsS2:null },
];
// 🔴 الترتيب هنا **جزء من البند** — `ecoWarehouseQueue` بترتّب بالأقدم
//    **تغليفًا** الأول (زي `ecoOfficeQueue` بالحرف). الترتيب بتاريخ الأوردر
//    كان هيدّي ترتيب تاني خالص، و`updatedAt` **اتشال بالكامل** في v1.30.0.
// ⚠️ ولاحظ إن الترتيب بوقت تغليف **S1** حتى لصفوف S2 (`#54301` · `#54173`) — v1.52.0:
//    الطرد الراجع هو الشحنة الأصلية. (قبلها كان `#54301` بيترتّب بوقت S2.)
const ELIGIBLE_NAMES = ['#54301', '#54173', '#54727', '#54580', '#54296', '#54175'];

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

// ══════════════════════════════════════════════════════════════
// v1.51.0 — الاستلام قطعة قطعة + دفتر القطع الراجعة
// ══════════════════════════════════════════════════════════════
// قطع الطرد لكل أوردر (اللي `order_items` بيرجّعها) — نفس شكل رد الـ Worker بالحرف:
// `{ lineItemId, sku, title, variantId, barcode, qty }`، ومفتاح القطعة في الواجهة
// `lineItemId#unitIndex` (نفس `unitKey` في الـ Worker).
const ORDER_ITEMS = {
  '7212244533570': [
    { lineItemId:'gid://shopify/LineItem/1', sku:'A / 44', title:'Shoe A - 44', variantId:'v1', barcode:'11111111', qty:1 },
    { lineItemId:'gid://shopify/LineItem/2', sku:'B / 41', title:'Shoe B - 41', variantId:'v2', barcode:'22222222', qty:2 },
  ],
  '7212244533571': [
    { lineItemId:'gid://shopify/LineItem/3', sku:'C / 40', title:'Shoe C - 40', variantId:'v3', barcode:'33333333', qty:1 },
  ],
  '7212244533578': [
    { lineItemId:'gid://shopify/LineItem/4', sku:'D / 42', title:'Shoe D - 42', variantId:'v4', barcode:'66666666', qty:1 },
  ],
  // ⚠️ أوردر قطعه ما اتحددتش (مفيش سجل إلغاء) — `itemsUnknown`
  '7212244533572': [],
  // قطعة مالهاش باركود — استلام يدوي بس
  '7212244533573': [
    { lineItemId:'gid://shopify/LineItem/5', sku:'E / 39', title:'Shoe E - 39', variantId:'v5', barcode:null, qty:1 },
  ],
};
// ⚠️ أوردرات بيرجّع لها `receive_order` 409 «القطع اتغيّرت» — اختبار مسار stale
const STALE_ORDERS = new Set(['7212244533573']);
SCAN_REPLIES['7212244533572'] = () => ({ ok:true, result:'success', code:'written', machine:'s1', logged:true,
  order:{ orderId:'7212244533572', orderName:'#54296', zone:'Cairo+Giza' }, warnings:[] });
SCAN_REPLIES['7212244533573'] = () => ({ ok:true, result:'success', code:'written', machine:'s2', logged:true,
  order:{ orderId:'7212244533573', orderName:'#54301', zone:'Cairo+Giza' }, warnings:[] });

// دفتر القطع (رد `get_return_items`) — بيتغيّر مع `receive_item` زي الـ Worker
const RI_SEED = () => ([
  { id:11, source:'partial_delivery', orderId:'7300000000001', orderName:'#60001', machine:'S1', lineItemId:'li-a',
    sku:'P / 43', barcode:'44444444', title:'Partial P - 43', unitIndex:1, status:'pending', createdAt:'2026-10-18T10:00:00Z', createdBy:'ops' },
  { id:12, source:'partial_delivery', orderId:'7300000000002', orderName:'#60002', machine:'S1', lineItemId:'li-b',
    sku:'P / 43', barcode:'44444444', title:'Partial P - 43', unitIndex:1, status:'pending', createdAt:'2026-10-20T10:00:00Z', createdBy:'ops' },
  { id:13, source:'order_return', orderId:'7300000000003', orderName:'#60003', machine:'S1', lineItemId:'li-c',
    sku:'Q / 41', barcode:'55555555', title:'Missing Q - 41', unitIndex:1, status:'missing', createdAt:'2026-10-19T10:00:00Z', createdBy:'wh' },
  { id:14, source:'partial_delivery', orderId:'7300000000004', orderName:'#60004', machine:'S1', lineItemId:'li-d',
    sku:'R / 40', barcode:null, title:'No barcode R', unitIndex:1, status:'pending', createdAt:'2026-10-21T10:00:00Z', createdBy:'ops' },
]);
let RI = RI_SEED();
const itemsCalls = [], receiveCalls = [], riCalls = [];

function riReply() {
  const counts = { pending: 0, missing: 0 };
  for (const r of RI) counts[r.status]++;
  return { ok:true, items:RI.slice(), counts, truncated:false, fetchedAt:new Date().toISOString() };
}
function orderItemsReply(b) {
  const digits = String(b.code || '').replace(/\D/g, '');
  const fn = SCAN_REPLIES[digits];
  if (!fn) return { ok:true, result:'rejected', code:'not_found', message:`مفيش أوردر على شوبيفاي بالرقم ${digits}`, scanned:b.code };
  const r = fn(b);
  if (r.result !== 'success' && r.result !== 'warning') return r;
  const items = ORDER_ITEMS[digits] || [];
  return { ok:true, result:'items', order:r.order, machine:r.machine, warnings:r.warnings || [],
           items, cycleKey:r.machine === 's2' ? 'gid://shopify/Return/9' : 'S1', itemsSource:'cancel_refund', itemsUnknown: !items.length };
}
function receiveOrderReply(b) {
  const digits = String(b.code || '').replace(/\D/g, '');
  if (STALE_ORDERS.has(digits))
    return [409, { ok:false, result:'stale', code:'items_changed', message:'قطع الأوردر اتغيّرت على شوبيفاي من وقت السكان — اسكن الأوردر تاني', error:'قطع الأوردر اتغيّرت' }];
  if ((b.missing || []).length && !b.missingAck)
    return [409, { ok:false, result:'needs_ack', code:'missing_ack', message:'فيه قطع ناقصة — لازم إقرار صريح', error:'فيه قطع ناقصة' }];
  const r = SCAN_REPLIES[digits]({ ...b, ack:true });
  const units = (ORDER_ITEMS[digits] || []).reduce((s, i) => s + i.qty, 0);
  const missing = (b.missing || []).length;
  const warnings = [...(r.warnings || [])];
  if (missing) warnings.push(`${missing} قطعة ناقصة — اتسجّلت «ناقصة» ومستنية مراجعة`);
  if (!units) warnings.push('قطع الطرد ما اتحددتش من شوبيفاي — الاستلام اتأكد يدويًا من غير سكان القطع');
  return [200, { ...r, result: warnings.length ? 'warning' : 'success', warnings, units, missing,
                 ledger: units ? { units, inserted: units, missing } : null }];
}
function receiveItemReply(b) {
  if (b.id) {
    const r = RI.find(x => x.id === b.id);
    if (!r) return { ok:true, result:'already', message:'القطعة دي اتسلّمت خلاص' };
    RI = RI.filter(x => x !== r);
    return { ok:true, result:'success', item:{ ...r, wasStatus:r.status } };
  }
  const cands = RI.filter(x => x.barcode === b.barcode)
    .sort((a, c) => (a.status === c.status ? 0 : a.status === 'pending' ? -1 : 1) || a.createdAt.localeCompare(c.createdAt));
  const r = cands[0];
  if (!r) return { ok:true, result:'not_found', barcode:b.barcode,
    message:'مفيش قطعة مستنية الاستلام بالباركود ده — لو ده طرد أوردر كامل، اسكن باركود الأوردر' };
  RI = RI.filter(x => x !== r);
  return { ok:true, result:'success', barcode:b.barcode, item:{ ...r, wasStatus:r.status } };
}

const DIAG = { ok:false, version:'1.5.0', checks:[
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
    // ── v1.51.0 ──
    else if (action === 'order_items') {
      const b = JSON.parse(route.request().postData() || '{}'); itemsCalls.push(b); body = orderItemsReply(b);
    }
    else if (action === 'receive_order') {
      const b = JSON.parse(route.request().postData() || '{}'); receiveCalls.push(b);
      const [st, bd] = receiveOrderReply(b);
      await route.fulfill({ status:st, contentType:'application/json', body:JSON.stringify(bd) }); return;
    }
    else if (action === 'get_return_items') body = riReply();
    else if (action === 'receive_item') {
      const b = JSON.parse(route.request().postData() || '{}'); riCalls.push(b); body = receiveItemReply(b);
    }
    else if (action === 'get_logs')        { logCalls.push(url.toString()); body = { ok:true, entries:[{ timestamp:'2026-10-25T10:00:00Z', employee:'ahmed', type:'update', order_name:'#58355', order_id:'1', value_before:'Office', value_after:'Warehouse', extra: JSON.stringify({ machine:'S2', result:'success', items:[{sku:'SKU-A',qty:2},{sku:'SKU-B',qty:1,missing:1}] }) }] }; }
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
  page.on('console', m => { if (m.type() === 'error' && !/net::ERR_|status of 409/.test(m.text())) errors.push(m.text()); });   // 409 = رد «القطع اتغيّرت» المقصود في ③
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
  // §UNIFIED (v1.54.0): السكانر شغّال دايمًا — مفيش «ابدأ تسجيل المرتجعات»
  await page.fill('#scanInput', String(code));
  await page.waitForTimeout(900);
}

// ══════════════════════════════════════════════════════════════
// ① الهب — الجلسة والهيدر وحارس النسخة
// ══════════════════════════════════════════════════════════════
console.log('\n══ Package-Transfer-To-Warehouse.html ══');
console.log('① الجلسة والهيدر الموحّد');
{
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/Package-Transfer-To-Warehouse.html`);
  await page.waitForTimeout(900);

  is(await page.locator('#loginOverlay').count() === 0,
     'مفيش شاشة دخول في الصفحة — الدخول في `index.html` بس');
  is((await page.locator('.app-title-text h1').first().textContent() || '').includes('قسم استلام المرتجعات'),
     'الهيدر الموحّد بعنوان الأداة');
  is(await page.locator('.hbtn-home').count() === 1, 'زرار 🏠 الرئيسية موجود');
  is((await page.locator('.hbtn[aria-label="تسجيل الخروج"]').count()) === 1,
     'زرار الخروج عليه `aria-label` (الـ✕ لوحده مايتقريش عند قارئ الشاشة)');

  const ver = (await page.locator('.hbtn.ver-btn').first().textContent() || '').trim();
  is(/v1\.\d+\.\d+/.test(ver), 'زرار النسخة بيقول نسخة الهب', ver);
  const clBadge = (await page.locator('#clLatestVerBadge').textContent() || '').trim();
  is(clBadge === ver.replace(/[^v0-9.]/g, ''), 'بادج سجل التحديثات == نسخة الهب', `${clBadge} ≠ ${ver}`);

  // 🔴 حارس النسخة لازم يسمّي **الـ Worker بتاع الأداة دي** — الهب بينادي
  //    تمن Workers، ورسالة بلا اسم بتخلّي الموظف يدوّر فيهم كلهم.
  is((await page.locator('#aboutWorkers').textContent() || '').includes('قسم استلام المرتجعات'),
     'جدول الـ Workers في «عن الأداة» اتملّى باسم الأداة');
  is(!(await page.locator('#aboutWorkers').textContent() || '').includes('قسم تسليمات المكتب'),
     '🔴 `PAGE_WORKERS` فيها Worker واحد — مش Worker أداة المكتب كمان');

  // §UNIFIED (v1.54.0): شاشة واحدة — السكانر والطابور ظاهرين من أول لحظة، ومفيش جلسة بدء/إنهاء
  is(await page.locator('#startSessionBtn').count() === 0 && await page.locator('#endSessionBtn').count() === 0 && await page.locator('#startCard').count() === 0,
     '🔴 مفيش زرار «ابدأ تسجيل المرتجعات» ولا «إنهاء الجلسة»');
  is(await page.locator('#scanInput').isVisible() && await page.locator('#rqBox').isVisible() && await page.locator('#rqTableWrap').isVisible(),
     '🔴 السكانر والطابور ظاهرين مع بعض من أول لحظة');
  is(await page.locator('#sessRemainBtn').count() === 0, 'زرار «المتبقي» اتشال — «تحديث» في رأس الطابور هو المصدر');
  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput', 'الفوكس على مربع السكان من أول لحظة');
  is(await page.locator('#doneBox').count() === 0 && await page.locator('#sessProg').count() === 0, '🔴 جدول «اتسجّلت» وشريط التقدّم اتشالوا (v1.56.0)');
  is(await page.locator('#scanCard .card-header').count() === 0 && await page.locator('#scanCard h2').count() === 0,
     '🔴 مفيش رأس (عنوان ولا عدّادات) فوق مربع السكان');
  is((await page.evaluate(() => document.getElementById('scanInput').getBoundingClientRect().top - document.getElementById('scanCard').getBoundingClientRect().top)) < 30,
     '🔴 مربع السكان لازق في أول البطاقة — مفيش مساحة فاضية فوقه', String(await page.evaluate(() => document.getElementById('scanInput').getBoundingClientRect().top - document.getElementById('scanCard').getBoundingClientRect().top)));
  is(await page.locator('#sessionWrap').count() === 0 && await page.locator('#rqTableWrap table').count() === 1,
     'جدول الطابور هو الجدول الوحيد في تاب الأوردرات');
  // §ADD-BTN (v1.55.0): زرار «➕ إضافة» في كل صف بدل نافذة «اختيار من القائمة»
  is(await page.locator('#pickOrderBtn').count() === 0 && await page.locator('#pickOverlay').count() === 0,
     '🔴 زرار «تسجيل أوردر يدوي» ونافذة الاختيار اتشالوا');
  const addN = await page.locator('#rqTableBody button[data-add-id]').count();
  is(addN === (await page.evaluate(() => rqState.orders.length)) && addN > 0,
     '🔴 زرار «➕ إضافة» في كل صف من الطابور', String(addN));
  is((await page.locator('#rqTableWrap thead th').allInnerTexts()).map(t => t.trim()).includes('إجراء'),
     'عمود «إجراء» في رأس الجدول');
  // العنوان فوق مربع الإدخال خالص (v1.55.0)
  is(await page.evaluate(() => {
       const h = document.getElementById('queueHead'), c = document.getElementById('scanCard');
       return !!h && !!(h.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) && h.textContent.includes('جاهز للرجوع للمخزن');
     }), '🔴 عنوان «🏭 جاهز للرجوع للمخزن» فوق مربع الإدخال');
  is(await page.evaluate(() => !document.getElementById('rqBox').textContent.includes('مرتجع أو ملغي ·')) && (await page.locator('#rqSub').textContent()).includes('مرتجع أو ملغي'),
     'السطر التوضيحي (`#rqSub`) في العنوان مش جوّه كارت الجدول');
  // معيار الجداول: كارت موحّد + صف «النتائج» بنفس رقم العدّاد + بلا table-layout ثابت ولا ellipsis
  is(await page.locator('#rqBox.unified-section .tbl-bar #rqResults').count() === 1 &&
     (await page.locator('#rqResults').textContent()) === (await page.locator('#rqCount').textContent()),
     '🔴 صف «النتائج» في كارت موحّد ورقمه = عدّاد الطابور');
  is(await page.evaluate(() => {
       const c = document.querySelector('#rqTableBody td.col-addr'); const cs = getComputedStyle(c);
       return cs.textOverflow !== 'ellipsis' && cs.whiteSpace !== 'nowrap';
     }), '🔴 العنوان بيلتف (مفيش ellipsis ولا nowrap)');
  is(await page.locator('#rqTableWrap table.eco-tbl-on').count() === 1 && await page.locator('#rqTableWrap thead .eco-hf').count() >= 4,
     'فلاتر رأس العمود شغّالة على جدول الطابور (قمع في الأعمدة القابلة للفلترة)');
  await page.locator('#rqTableBody button[data-add-id]').first().click();
  await page.waitForTimeout(900);
  is(await page.locator('#recvBox').isVisible(),
     '🔴 «➕ إضافة» فتحت لوحة الاستلام (نفس مسار السكان)');
  is(!((await page.locator('#recvTableWrap thead').innerText()).includes('المنتج') && !(await page.locator('#recvTableWrap thead').innerText()).includes('باركود')) &&
     (await page.locator('#recvTableWrap thead th').allInnerTexts()).every(t => t.trim() !== 'المنتج'),
     '🔴 عمود «المنتج» اتشال من لوحة الاستلام');
  is((await page.locator('#recvTableWrap thead th').first().innerText()).trim() === 'رقم الأوردر' &&
     (await page.locator('#recvBody tr').first().locator('td').first().innerText()).includes('#') &&
     await page.locator('#recvBox .recv-head, #recvTitle, #recvSub').count() === 0,
     '🔴 لوحة الاستلام: جدول بس بعمود «رقم الأوردر» أول عمود وبدون عنوان');
  const cs = async id => page.evaluate(i => { const c = getComputedStyle(document.getElementById(i)); return [c.backgroundColor, c.color, c.borderTopColor]; }, id);
  const [cb, cc, cbd] = await cs('recvCancelBtn');
  is(cb === 'rgb(255, 255, 255)' && cc === 'rgb(220, 38, 38)',
     'زرار «إلغاء الاستلام»: خلفية بيضا وإطار وخط أحمر', [cb, cc].join(' | '));
  is((await cs('recvFinishBtn'))[0] === 'rgb(22, 163, 74)' && (await page.locator('#recvFinishBtn').innerText()).includes('تسجيل الاستلام'),
     '«تسجيل الاستلام» أخضر');
  is((await page.locator('#recvBody').innerText()).includes('في انتظار التسجيل') && !(await page.locator('#recvBody').innerText()).includes('مستنية'),
     'الحالة «⏳ في انتظار التسجيل»');
  await page.click('#recvCancelBtn');
  is(!(await page.locator('#recvBox').isVisible()) && await page.locator('#scanInput').isVisible() && await page.locator('#rqBox').isVisible(),
     'إلغاء الاستلام بيقفل اللوحة والسكانر والطابور لسه ظاهرين');
  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));
  await ctx.close();
}

{
  const { page, ctx } = await newPage({ withSession:false });
  await page.goto(`${BASE}/Package-Transfer-To-Warehouse.html`);
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
  await page.goto(`${BASE}/Package-Transfer-To-Warehouse.html`);
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
  is(names.some(n => n.includes('#54173')),
     '🔴 **الاسترجاع الخالص** (S2 = Returned · متغلّف على S1 بس · مفيش طرد S2) **ظاهر** — الطرد الراجع هو الشحنة الأصلية (`#53764`)');
  is(!names.some(n => n.includes('#54174')),
     '🔴 S2 مرتجع **والشحنة الأصلية ما اتغلّفتش** (s2 فقط موجود) **مستبعَد** — الشرط على تغليف S1 مش S2');
  is(!names.some(n => n.includes('#54888')),
     '🔴 أوردر `Ready` (لا مرتجع ولا ملغي) **مستبعَد** — الأداة مابتسجّلش رجوع لطرد خارج');
  is(names.some(n => n.includes('#54301')),
     'صف S2 المرتجع (استبدال) والشحنة الأصلية متغلّفة **ظاهر**');
  const whyS2 = await page.evaluate((raw) => {
    const g = ecoWarehouseGate(raw.find(o => o.orderName === '#54174')); return g.code + '/' + g.machine;
  }, RAW);
  is(whyS2 === 'not_packed/s2', '🔴 وسبب استبعاد `#54174` هو `not_packed` على ماكينة S2', String(whyS2));
  const rowsData = await page.evaluate((raw) => ecoWarehouseQueue(raw).map(o => [o.orderName, o.packedAt, o.packedBy]), RAW);
  is(rowsData.find(r => r[0] === '#54173')?.[1] === '2026-09-02T11:06:53Z',
     '🔴 `packedAt` لصف S2 = وقت تغليف **S1** (الطرد الراجع)', JSON.stringify(rowsData.find(r => r[0] === '#54173')));

  // 🔴🔴 **الفلتر الجديد (v1.30.0)** — الطابور بيعرض عهدة `Office` **بس**
  is(!names.some(n => n.includes('#54555')),
     '🔴 المرتجع اللي عهدته `Courier` **مستبعَد** — الطابور بيعرض اللي في المكتب بس');
  is(!names.some(n => n.includes('#54556')),
     '🔴 والمرتجع اللي عهدته **فاضية** مستبعَد كمان — «مش عارفين كان فين» مش طابور شغل');
  // ⚠️ والصفّان دول **مؤهلان في الـ Worker** — الفلتر عرض بس، والسكانة شغّالة
  //    عليهم. البند ده بيقرا البوابة مباشرةً عشان يثبت السبب مش النتيجة.
  const whyCourier = await page.evaluate((raw) =>
    ecoWarehouseGate(raw.find(o => o.orderName === '#54555')).code, RAW);
  is(whyCourier === 'not_in_office',
     '🔴 وسبب الاستبعاد `not_in_office` — مش `status` ولا `not_packed`', String(whyCourier));

  // 🔴 الترتيب جزء من العقد — الأقدم **تغليفًا** الأول
  is(names[0].includes('#54301') && names[names.length - 1].includes('#54175'),
     '🔴 الترتيب بالأقدم تغليفًا الأول (S1 على الماكينتين)',
     names.join(' · '));

  const cnt = (await page.locator('#rqCount').textContent() || '').trim();
  const badge = (await page.locator('#rqBadge').textContent() || '').trim();
  is(cnt === String(ELIGIBLE_NAMES.length), 'العدّاد == صفوف الجدول', cnt);
  is(badge === cnt, 'بادج زرار التحديث == العدّاد', `${badge} ≠ ${cnt}`);

  // 🔴 البند اللي بيقفل درس R1: الصفحة بتعدّ من **نفس** دالة الـ shell
  const gateCount = await page.evaluate((raw) => ecoWarehouseQueue(raw).length, RAW);
  is(gateCount === ELIGIBLE_NAMES.length,
     '`ecoWarehouseQueue` في الـ shell بترجّع نفس الرقم بالظبط', String(gateCount));

  // 🔴 **والبوابتان مختلفتان فعلاً** — لو حد وحّدهم، الملغي هيختفي من هنا
  const officeCount = await page.evaluate((raw) => ecoOfficeQueue(raw).length, RAW);
  is(officeCount !== gateCount,
     '🔴 `ecoOfficeQueue` بترجّع رقم مختلف على نفس البيانات — البوابتان مش نسخة واحدة',
     `office ${officeCount} · warehouse ${gateCount}`);

  // (v1.55.1) عمود «الحالة» اتشال من الجدولين — اتأكد من غيابه تحت
  const rowTxt = (n) => page.$$eval('#rqTableBody tr', (trs, nm) =>
    (trs.map(t => t.textContent).find(t => t.includes(nm)) || ''), n);
  const rowsTxt = await page.$$eval('#rqTableBody tr', trs => trs.map(t => t.textContent));
  // 🔴 v1.53.0 — صف S2 بيتقسّم من `s2Cycle`: استبدال · استرجاع · غير معروف (مش تخمين)
  const typeCell = async (n) => page.$$eval('#rqTableBody tr', (trs, nm) => {
    const tr = trs.find(t => t.textContent.includes(nm)); return tr ? tr.cells[2].textContent.trim() : '';
  }, n);
  const tExch = await typeCell('#54301'), tRet = await typeCell('#54173'), tUnk = await typeCell('#54175'), tS1 = await typeCell('#54727');
  is(tExch === 'استبدال', '🔴 `s2Cycle = exchange` → «استبدال»', tExch);
  is(tRet === 'استرجاع', '🔴 `s2Cycle = return` → «استرجاع»', tRet);
  is(tUnk === 'استبدال/استرجاع', '🔴 `s2Cycle` فاضي → «استبدال/استرجاع» مش تخمين', tUnk);
  is(tS1 === 'عادي', 'صف S1 لسه «عادي»', tS1);

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
  // 🔴 **أعمدة v1.52.0 (قرار أحمد 22-10-2026):** «العميل» و«تاريخ الأوردر» اتشالوا، و«العنوان» بعد رقم الأوردر
  is(heads[0] === 'رقم الأوردر' && heads[1] === 'العنوان',
     '🔴 عمود «العنوان» **بعد رقم الأوردر مباشرة**', heads.join(' | '));
  is(!heads.includes('العميل') && !heads.includes('تاريخ الأوردر'),
     '🔴 عمودا «العميل» و«تاريخ الأوردر» اتشالوا', heads.join(' | '));
  const addrOf = await page.$$eval('#rqTableBody tr', trs => Object.fromEntries(trs.map(t => [t.cells[0].textContent.trim(), t.cells[1].textContent.trim()])));
  is(addrOf['#54727'] === '12 شارع التحرير، الدقي، الجيزة',
     'خانة العنوان بتعرض `address` اللي جاي من الـ Worker بالحرف', JSON.stringify(addrOf).slice(0, 200));
  is(!(await page.$('#rqTableBody .age-badge')), 'ولا بادج «عمر الأوردر» في الجدول');
  const cells = await page.$$eval('#rqTableBody tr:first-child td', td => td.length);
  is(cells === heads.length, 'خلايا الصف == أعمدة الهيدر', `${cells} ≠ ${heads.length}`);
  // 🔴 §UNIFIED — نفس الأعمدة السبعة لكل الصفوف
  is(heads.join('|') === 'رقم الأوردر|العنوان|نوع الأوردر|موقع الشحنة|النتيجة|الوقت|إجراء',
     '🔴 الأعمدة بالترتيب المتفق عليه (بلا «الحالة») + عمود «إجراء» (➕ إضافة) في الآخر', heads.join(' | '));
  is((await rowTxt('#54727')).includes('⏳ في انتظار التسجيل') && !(await rowTxt('#54727')).includes('مستنية'), 'صف الطابور عمود «النتيجة» فيه «⏳ في انتظار التسجيل»');
  // ⛔ ولا أثر لـ`updatedAt` في الصفحة نفسها
  const pageSrc = await page.content();
  is(!/data-rq-upd|rqSinceUpdate/.test(pageSrc),
     '🔴 صفر أثر لـ`rqSinceUpdate`/`data-rq-upd` في الصفحة');

  // النافذة الزمنية بتتقال على الشاشة، وجاية من الرد مش مكتوبة بالإيد
  // 🔴 **الأرضية مكتوبة على الشاشة وجاية من الرد** — لو الصفحة كتبتها
  //    بالإيد، تغيير الأرضية في الـ Worker بيسيب الشاشة بتقول القديم
  //    **في صمت** (درس R1).
  // ⚠️ والمقارنة بنص `ecoYmdToDMY` **المحسوب في الصفحة** مش بنص مكتوب هنا.
  const subTxt  = (await page.locator('#rqSub').textContent() || '');
  const wantDay = await page.evaluate((d) => ecoYmdToDMY(d), ORDERS_SINCE);
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
console.log('③ السكان — الاستلام قطعة قطعة (v1.51.0)');
{
  itemsCalls.length = 0; receiveCalls.length = 0; scanCalls.length = 0;
  const { page, ctx, errors } = await newPage();
  page.on('dialog', d => d.accept());
  await page.goto(`${BASE}/Package-Transfer-To-Warehouse.html`);
  await page.waitForTimeout(1200);
  const txt = async (s) => ((await page.locator(s).textContent()) || '').trim();
  const panelOpen = async () => (await page.locator('#recvBox').evaluate(e => getComputedStyle(e).display)) !== 'none';
  const closeModal = async () => { await page.locator('#outcomeFtr button').first().click(); await page.waitForTimeout(250); };

  is(await page.locator('button:has-text("إضافة يدوي")').count() === 0,
     'مفيش زرار إدخال يدوي — السكانر هو المدخل الوحيد');
  is(await page.locator('#btnUpdate').count() === 0, 'مفيش زرار تنفيذ دفعة');
  const heads = await page.$$eval('#rqTableWrap thead th', t => t.map(x => x.textContent.trim()));
  is(!heads.some(h => h.includes('عدد القطع')), 'عمود «عدد القطع» اتشال من الطابور', heads.join(' | '));
  is(!(await panelOpen()), 'لوحة الاستلام مخفية قبل أي سكان');

  // ── ① مسار سليم: سكان الأوردر ← القطع ← إنهاء تلقائي ──
  const before = await page.$$eval('#rqTableBody tr', t => t.length);
  await scan(page, '7212244533570');
  is(itemsCalls.length === 1 && itemsCalls[0].code === '7212244533570' && itemsCalls[0].employee === 'tester',
     'سكان الأوردر بينادي `order_items` (قراءة) بالموظف');
  is(scanCalls.length === 0, '🔴 مفيش نداء `scan` (كتابة) من سكان الأوردر — الكتابة بعد القطع بس');
  is(receiveCalls.length === 0, 'ومفيش `receive_order` قبل سكان القطع');
  is(await panelOpen(), 'لوحة الاستلام اتفتحت');
  is((await txt('#rqBadge')) === (await txt('#rqCount')) && (await txt('#rqCount')) !== '—',
     'بادج «تحديث» في رأس الطابور == العدّاد');
  is((await txt('#rqAgo')).length > 0 && (await txt('#rqAgo')) !== 'لسه ما اتحدّثش', 'ولوحة «آخر تحديث» اتملّت بعد الجلب');
  is(await page.locator('#doneCount').count() === 0, 'مربع «اتسجّل في الجلسة دي» المكرر اتشال');
  is(!(await page.locator('#recvCancelBtn').isDisabled()), '🔴 زرار الإلغاء مفتوح بعد فتح اللوحة (اترسمت بعد ما السكانة خلصت)');
  is(await page.$$eval('#recvBody tr', t => t.length) === 3, 'اللوحة فيها ٣ قطع (A×1 + B×2) — صف لكل قطعة');
  is(await page.locator('#recvProg').count() === 0, 'عدّاد القطع (0 / N) اتشال من اللوحة');
  is(await page.locator('#recvFinishBtn').isDisabled(), 'زرار الإنهاء مقفول طول ما فيه قطع مستنية');
  is(await page.evaluate(() => window.shellIsBusy()) === false, 'الخروج التلقائي مش موقوف قبل أي علامة');
  await scan(page, '11111111');
  is(await page.locator('#recvBody .recv-row.u-done').count() === 1, 'سكان قطعة A → قطعة واحدة اتسجلت');
  is(await page.evaluate(() => window.shellIsBusy()) === true, '🔴 الخروج التلقائي موقوف بعد ما قطعة اتعلّمت');
  is(receiveCalls.length === 0, 'سكان القطعة جوّه الأوردر مابيكتبش لوحده');
  await scan(page, '22222222');
  await scan(page, '22222222');
  await page.waitForTimeout(400);
  is(receiveCalls.length === 1, '🔴 آخر قطعة → `receive_order` اتنادى لوحده (إنهاء تلقائي)');
  const rc = receiveCalls[0] || {};
  is((rc.scanned || []).length === 3 && (rc.missing || []).length === 0,
     'الجسم فيه ٣ قطع مسكونة وصفر ناقص', JSON.stringify(rc).slice(0, 200));
  is((rc.scanned || []).map(s => s.key).sort().join(',') ===
     'gid://shopify/LineItem/1#1,gid://shopify/LineItem/2#1,gid://shopify/LineItem/2#2',
     '🔴 مفاتيح القطع `lineItemId#unitIndex` — نفس صيغة الـ Worker بالحرف');
  is((rc.scanned || []).every(s => s.mode === 'scan'), 'وضع كل قطعة `scan`');
  is(!(await panelOpen()), 'اللوحة اتقفلت بعد النجاح');
  is(await page.locator('#outcomeOverlay.open').count() === 0, 'النجاح الكامل توست مش نافذة');
  is(await page.$$eval('#rqTableBody tr', t => t.length) === before - 1,
     '🔴 الصف اتشال من الطابور بعد النجاح');
  is(await page.locator('#doneBox').count() === 0 && await page.locator('#sessionBody').count() === 0, 'مفيش جدول «اتسجّلت» بعد التسجيل — النتيجة في التوست والسجل');
  // 🔴 العرض الضيق (تحت ٧٦٠px): صف من سطرين بدل scroll أفقي، والهيدر مخفي
  await page.setViewportSize({ width:520, height:900 });
  await page.waitForTimeout(250);
  is(await page.evaluate(() => { const w = document.getElementById('rqTableWrap'); return w.scrollWidth <= w.clientWidth + 1; }) &&
     await page.locator('#rqTableWrap thead').isHidden(),
     '🔴 على عرض ٥٢٠px: مفيش scroll أفقي في الجدول والهيدر مخفي (صف من سطرين)');
  is(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'ومفيش scroll أفقي في الصفحة كلها');
  await page.setViewportSize({ width:1280, height:720 });

  // ── ② قطعة غلط + أوردر تاني والأوردر مفتوح (الملغي مؤهل) ──
  await scan(page, '7212244533571');
  is(await panelOpen(), '🔴 الأوردر الملغي **مؤهل** — اللوحة اتفتحت (عكس أداة المكتب)');
  await page.evaluate(() => { window.__beeps = []; });
  await scan(page, '99999999');
  is(receiveCalls.length === 1, 'قطعة مش من الأوردر = صفر كتابة');
  is((await page.evaluate(() => window.__beeps.slice())).includes(300), 'وبنغمة الفشل (300)');
  is(await page.locator('#recvBody .recv-row.u-done').count() === 0, 'ومفيش قطعة اتسجلت');
  const ic = itemsCalls.length;
  await scan(page, '7212244533576');
  is(itemsCalls.length === ic, 'سكان أوردر تاني والأوردر مفتوح مابيفتحش أوردر تاني');
  // 🔴 v1.54.1 — زرار «ناقصة» اتشال من لوحة الاستلام (قرار أحمد 25-10-2026)
  is(await page.locator('#recvBody button[data-act="miss"]').count() === 0 && !(await txt('#recvBody')).includes('ناقصة'),
     '🔴 مفيش زرار «ناقصة» في لوحة الاستلام');
  is(await page.locator('#recvFinishBtn').isDisabled(), 'الإنهاء مقفول طول ما فيه قطع مستنية');
  const nUnits = await page.locator('#recvBody .recv-row').count();
  for (let i = 0; i < nUnits; i++) { await page.locator('#recvBody button[data-act="manual"]').first().click(); await page.waitForTimeout(100); }
  is(!(await page.locator('#recvFinishBtn').isDisabled()), 'بعد استلام كل القطع الإنهاء اتفتح');
  await page.locator('#recvFinishBtn').click();
  await page.waitForTimeout(700);
  const rc2 = receiveCalls[1] || {};
  is(receiveCalls.length === 2 && !rc2.missingAck && (rc2.missing || []).length === 0 && (rc2.scanned || []).length === nUnits,
     '🔴 `receive_order` اتبعت بكل القطع وصفر ناقص وبلا `missingAck`', JSON.stringify(rc2).slice(0, 200));
  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput', 'الفوكس رجع لمربع السكان');

  // ── ③ حالة شاذة: إقرار قبل فتح الاستلام + يدوي + تراجع ──
  await scan(page, '7212244533578');
  is(itemsCalls.at(-1).ack === false && !(await panelOpen()), 'الحالة الشاذة: `ack:false` ومفيش لوحة');
  is((await txt('#outcomeModal')).includes('مرتجعين/ملغيين'), 'نافذة التحذير بالتفاصيل');
  await page.locator('#outcomeFtr button:has-text("كمّل برضه")').click();
  await page.waitForTimeout(900);
  is(itemsCalls.at(-1).ack === true && await panelOpen(), 'بعد الإقرار `ack:true` واللوحة اتفتحت');
  await page.locator('#recvBody button[data-act="manual"]').first().click();
  await page.waitForTimeout(120);
  is((await txt('#recvBody')).includes('يدوي'), 'الاستلام اليدوي بيتعلّم «يدوي»');
  await page.locator('#recvBody button[data-act="undo"]').first().click();
  await page.waitForTimeout(120);
  is(await page.locator('#recvBody .recv-row.u-done').count() === 0, 'التراجع بيرجّع القطعة مستنية');
  await page.locator('#recvBody button[data-act="manual"]').first().click();
  await page.waitForTimeout(120);
  await page.locator('#recvFinishBtn').click();
  await page.waitForTimeout(700);
  const rc3 = receiveCalls.at(-1) || {};
  is(rc3.ack === true && rc3.scanned?.[0]?.mode === 'manual', '🔴 `receive_order` بيكمّل الإقرار (`ack:true`) ووضع القطعة `manual`');
  await closeModal();

  // ── ④ قطع ما اتحددتش — تأكيد يدوي ──
  await scan(page, '7212244533572');
  is((await txt('#recvNote')).includes('ما قدرناش نحدد'), 'تحذير «القطع ما اتحددتش» ظاهر');
  is(!(await page.locator('#recvFinishBtn').isDisabled()),
     'الإنهاء مفتوح (تأكيد يدوي)');
  await page.locator('#recvFinishBtn').click();
  await page.waitForTimeout(250);
  const nR = receiveCalls.length;
  await page.locator('#outcomeFtr button:has-text("سجّل الاستلام")').click();
  await page.waitForTimeout(700);
  is(receiveCalls.length === nR + 1 && receiveCalls.at(-1).itemsUnknownAck === true,
     '`itemsUnknownAck:true` بيتبعت بعد التأكيد بس');
  if (await page.locator('#outcomeOverlay.open').count()) await closeModal();

  // ── ⑤ القطع اتغيّرت (409) — مفيش كتابة واللوحة بتتقفل ──
  await scan(page, '7212244533573');
  is(await page.locator('#recvBody .recv-row').count() >= 1 && !(await txt('#recvBody')).includes('مالهاش باركود'),
     'عمود الباركود اتشال من لوحة الاستلام (الصف بيتعرض بـ SKU وصورة بس)');
  await page.locator('#recvBody button[data-act="manual"]').first().click();
  await page.waitForTimeout(120);
  await page.locator('#recvFinishBtn').click();
  await page.waitForTimeout(700);
  is((await txt('#outcomeModal')).includes('اتغيّر'), '🔴 409 «القطع اتغيّرت» بيتقال — مش «تم»');
  is(!(await panelOpen()), 'واللوحة اتقفلت عشان يسكن الأوردر تاني');
  await closeModal();

  // ── ⑥ إلغاء الاستلام ──
  await scan(page, '7212244533570');
  await scan(page, '11111111');
  const nR2 = receiveCalls.length;
  await page.locator('#recvCancelBtn').click();
  await page.waitForTimeout(200);
  is(!(await panelOpen()) && receiveCalls.length === nR2, 'الإلغاء (بتأكيد) بيقفل اللوحة بصفر كتابة');
  is(await page.evaluate(() => window.shellIsBusy()) === false, 'والخروج التلقائي رجع شغّال');

  // ── ⑦ الرفض و«خلاص متعمل» ──
  await scan(page, '7212244533574');
  is((await txt('#outcomeModal')).includes('قسم مرتجعات بوسطة') && await page.locator('#outcomeModal.fail').count() === 1,
     '🔴 بوسطة: نافذة رفض حمرا بتوجّه لأداة بوسطة بالاسم');
  await page.mouse.click(5, 5); await page.waitForTimeout(200);
  is(await page.locator('#outcomeOverlay.open').count() === 1, 'الضغط برّه النافذة مايقفلهاش');
  await closeModal();
  await scan(page, '7212244533575');
  const t2 = await txt('#outcomeModal');
  is(t2.includes('ما اتغلّفش') && t2.includes('مفيش طرد يرجع'), 'رفض «ما اتغلّفش» بيقول إن مفيش طرد أصلاً');
  await closeModal();
  await scan(page, '7212244533576');
  is((await txt('#outcomeModal')).includes('في المخزن خلاص') &&
     await page.locator('#outcomeModal.fail').count() === 0 && await page.locator('#outcomeModal.warn').count() === 0,
     '🔴 «خلاص متعمل» محايدة (`constants` §12)');
  await closeModal();
  await scan(page, '9999999999999');
  is((await txt('#outcomeModal')).includes('مفيش أوردر'), 'الأوردر المش موجود بيتقال بالسبب');
  await closeModal();
  is(scanCalls.length === 0, '🔴 ولا نداء `scan` واحد طول الجلسة — المسار كله `order_items`/`receive_order`');

  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ③-ب «قطع مستنية الرجوع للمخزن» — دفتر D1 + السكان السايب
// ══════════════════════════════════════════════════════════════
console.log('③-ب قطع مستنية الرجوع للمخزن');
{
  RI = RI_SEED(); riCalls.length = 0;
  const { page, ctx, errors } = await newPage();
  page.on('dialog', d => d.accept());
  await page.goto(`${BASE}/Package-Transfer-To-Warehouse.html`);
  await page.waitForTimeout(1200);
  const txt = async (s) => ((await page.locator(s).textContent()) || '').trim();
  const closeModal = async () => { await page.locator('#outcomeFtr button').first().click(); await page.waitForTimeout(250); };

  is(await txt('#riCount') === '4', 'العدّاد = المستنية + الناقصة (٤)', await txt('#riCount'));
  is(await page.$$eval('#riTableBody tr', t => t.length) === 4, 'صف لكل قطعة');
  is((await txt('#riTableBody')).includes('تسليم جزئي') && (await txt('#riTableBody')).includes('ناقصة'),
     'المصدر والحالة معروضين');
  await scan(page, '44444444');
  is(riCalls[0]?.barcode === '44444444' && !riCalls[0]?.id, 'سكان باركود قطعة بينادي `receive_item` بالباركود');
  is(itemsCalls.filter(c => c.code === '44444444').length === 0, 'ومابيفتحش أوردر');
  is(await txt('#riCount') === '3', 'العدّاد نزل ٣');
  await scan(page, '44444444');
  // 🔴 **v1.52.0 — تاب «منتجات التسليم الجزئي»:** القايمة في تاب لوحده وفيه مربع سكان قطع خاص بيه
  const tabNames = await page.$$eval('#mainTabsBar .main-tab-btn', b => b.map(x => x.textContent.trim()));
  is(tabNames.length === 3 && tabNames[0].includes('مرتجعات + لواغي') && tabNames[1].includes('منتجات التسليم الجزئي') && tabNames[2].includes('سجل العمليات'),
     '🔴 التابات: «مرتجعات + لواغي» · «منتجات التسليم الجزئي» · «سجل العمليات»', tabNames.join(' | '));
  is(!tabNames.some(t => t.includes('السكانر')), 'اسم تاب «السكانر» القديم اتشال', tabNames.join(' | '));
  is(await page.locator('#rqBox').isVisible() && await page.locator('#scanInput').isVisible() && !(await page.locator('#riBox').isVisible()),
     '🔴 تاب «الأوردرات» فيه السكانر وطابور الأوردرات **بس** — قايمة القطع مش فيه');
  await page.click('#tabPartial');
  await page.waitForTimeout(300);
  is(await page.locator('#riBox').isVisible() && !(await page.locator('#rqBox').isVisible()) && !(await page.locator('#scanInput').isVisible()),
     '🔴 تاب «منتجات التسليم الجزئي» فيه قايمة القطع بس');
  is(await page.evaluate(() => document.activeElement?.id) === 'scanInputRi', 'الفوكس راح لمربع سكان القطع في التاب ده');
  // سكان قطعة من مربع التاب ده
  await page.fill('#scanInputRi', '55555555');
  await page.waitForTimeout(900);
  is(riCalls.at(-1)?.barcode === '55555555', 'سكان قطعة من مربع تاب «التسليم الجزئي» بينادي `receive_item` بالباركود');
  is(await txt('#riCount') === '1', 'العدّاد ١');
  // باركود أوردر في المربع ده = توجيه مش فتح أوردر
  const itemsBefore = itemsCalls.length;
  await page.fill('#scanInputRi', '7212244533570');
  await page.waitForTimeout(900);
  is(itemsCalls.length === itemsBefore && !(await page.locator('#recvBox').isVisible()),
     '🔴 باركود أوردر في مربع القطع **مابيفتحش لوحة استلام** (التاب مايشوفهاش) — بيتوجّه لتاب «الأوردرات»');
  await page.click('#tabScanner');
  await page.waitForTimeout(200);
  is(await page.evaluate(() => document.activeElement?.id) === 'scanInput', 'الرجوع لتاب «الأوردرات» بيرجّع الفوكس للسكانر');
  await scan(page, '44444444');
  is((await txt('#outcomeModal')).includes('مفيش قطعة مستنية'), 'باركود مالوش سطر مستني بيتقال بالنص');
  await closeModal();
  await page.click('#tabPartial');   // الاستلام اليدوي من زرار في قايمة التاب ده
  await page.waitForTimeout(200);
  await page.locator('#riTableBody button[data-ri-id="14"]').click();
  await page.waitForTimeout(700);
  is(riCalls.at(-1)?.id === 14, 'الاستلام اليدوي (بتأكيد) بيبعت `id`');
  is(await txt('#riCount') === '0' && (await txt('#riEmpty')).includes('مفيش قطع'), 'القايمة فضيت بالنص');
  is(errors.length === 0, 'صفر أخطاء في الكونسول', errors.join(' | '));

  // صف الرئيسية == القايمة (درس R1)
  RI = RI_SEED();
  const home = await ctx.newPage();
  await home.route('**/*.workers.dev/**', makeStub());
  await home.addInitScript(() => {
    try {
      localStorage.setItem('warehouse_ops_worker_secret', 'test-secret-0123456789');
      sessionStorage.setItem('woc_session', JSON.stringify(
        { v:1, username:'tester', displayName:'الموظف التجريبي', loginAt:new Date().toISOString() }));
      sessionStorage.removeItem('woc_queue_return_items');
    } catch {}
  });
  await home.goto(`${BASE}/index.html`);
  await home.waitForTimeout(2200);
  const hc = ((await home.locator('#cntReturnItems').textContent()) || '').trim();
  is(hc === '4', '🔴 صف «قطع مستنية الرجوع» في الرئيسية == الدفتر (٣ مستنية + ١ ناقصة)', hc);
  const chips = ((await home.locator('#chipsReturnItems').textContent()) || '');
  is(chips.includes('تسليم جزئي') && chips.includes('ناقصة'), 'مربعا «تسليم جزئي» و«ناقصة» في الصف', chips);
  const href = await home.locator('#rowReturnItems').getAttribute('href');
  is(String(href).includes('#riBox'), 'الصف بيفتح الصفحة على القايمة', String(href));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ④ النغمات — `playBeep` مالهاش أي أثر في الـ DOM
// ══════════════════════════════════════════════════════════════
console.log('④ نغمات playBeep');
{
  const { page, ctx } = await newPage();
  await page.goto(`${BASE}/Package-Transfer-To-Warehouse.html`);
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__beeps = []; });
  await scan(page, '7212244533571');
  await scan(page, '33333333');
  await page.waitForTimeout(400);
  const okBeeps = await page.evaluate(() => window.__beeps.slice());
  is(okBeeps.includes(1400) && okBeeps.includes(880), 'فتح الأوردر وسكان القطعة `scan` (1400) والإنهاء `success` (880)', JSON.stringify(okBeeps));
  await page.evaluate(() => { window.__beeps = []; });
  await scan(page, '7212244533574');
  const failBeeps = await page.evaluate(() => window.__beeps.slice());
  is(failBeeps.includes(300) && !failBeeps.includes(880), 'الرفض بيطلّع نغمة `error` (300)', JSON.stringify(failBeeps));
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ⑤ تاب السجل + الفحص الذاتي
// ══════════════════════════════════════════════════════════════
console.log('⑤ السجل والفحص الذاتي');
{
  const { page, ctx, errors } = await newPage();
  await page.goto(`${BASE}/Package-Transfer-To-Warehouse.html`);
  await page.waitForTimeout(900);
  await page.click('#tabLog');
  await page.waitForTimeout(700);

  const heads = await page.$$eval('#panelLog thead th', th => th.map(t => t.textContent.replace(/[^؀-ۿ →]/g,'').trim()));
  is(heads.length === 8 && !heads.some(h => h.includes('من →')) && heads.some(h => h.includes('المنتجات')), 'جدول السجل ٨ أعمدة: بلا «من → إلى» وبعمود «المنتجات (SKU × العدد)»', heads.join(' · '));
  const logTxt = await page.locator('#logTableBody').innerText();
  is(logTxt.includes('SKU-A') && logTxt.includes('2') && logTxt.includes('SKU-B') && logTxt.includes('ناقصة') && !logTxt.includes('→'),
     '🔴 السجل بيعرض SKU × العدد (والناقص) وبلا «من → إلى»', logTxt.slice(0,120));
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
