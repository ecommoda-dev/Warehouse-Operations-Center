// ══════════════════════════════════════════════════════════════
// docs/pack-check.mjs — فحص متصفح فعلي لـ `pack.html`
//
// 🔴 **ليه ملف تالت وما اتضافش لملف قايم؟** نفس قرار `browser-check.mjs`
//    و`sku-barcode-check.mjs`: كل ملف بيشغّل Worker وهمي بشكل رد مختلف
//    تمامًا. Worker وهمي واحد بيرد على تلات أدوات معناه إن أول تعديل في رد
//    واحدة بيكسر اختبار التانيتين.
//
// 🔴 **الملف ده اتكتب عشان §ELIGIBILITY** (هب v1.21.0 · Worker v2.6.0):
//    الحفرة اللي اتقفلت كانت **صامتة بالكامل** — أوردر ملغي بيفتح شاشة
//    التغليف عادي وصفر خطأ في الكونسول. مراجعة كود مابتمسكش ده؛ اللي
//    بيمسكه إن الصفحة تتفتح فعلاً ويتسكن فيها أوردر ملغي.
//
// التشغيل:  npm i playwright postcss --no-save && node docs/pack-check.mjs
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

// ── الأوردرات الوهمية — كل واحد بيمثّل سيناريو من جدول السكان ────────────
const LI = (q, c, f, sku) => ({ id:`gid://shopify/LineItem/${sku}`, title:'حذاء رياضي', sku,
  quantity:q, currentQuantity:c, fulfillableQuantity:f, barcode:'B'+sku, image:null, options:[] });

const PROFILE = (o) => ({
  name:o.name, orderId:'900'+o.n, gid:`gid://shopify/Order/900${o.n}`,
  createdAt:'2026-09-02T08:00:00Z', note:'', edited:false, stage:o.stage||'S1',
  fulfillmentStatus:o.ff||'UNFULFILLED', financialStatus:o.fin||'PENDING',
  cancelledAt:o.cancelledAt||null, cancelReason:o.cancelReason||null,
  s1Status:o.s1===undefined?'Ready':o.s1, s2Status:o.s2||null,
  printingTimeS1:o.p1===undefined?'2026-09-09T13:40:00Z':o.p1, printingTimeS2:o.p2||null,
  packedByS1:null, packedByS2:null, packingDateS1:null, packingDateS2:null, packingDateLog:null,
  courier:'Bosta', zone:'Cairo+Giza', lineItems:o.li,
});

// كل مفتاح = اسم أوردر، وقيمته الرد الكامل بتاع `get_order`
const ORDERS = {
  // ① مؤهل تمامًا
  '53197': (n) => ({ ok:true, stage:'S1', stageAnalysis:{stage:'S1',conflict:false,unclear:false,signals:{}},
    order:{ id:'9001', orderId:'9001', name:'#53197', note:'' },
    items:[{ ...LI(2,2,2,'SD1-45'), }],
    profile:PROFILE({n:1,name:'#53197',li:[LI(2,2,2,'SD1-45')]}),
    eligibility:{ level:'ok', code:'ok', title:'', reason:'', hints:[] } }),
  // ⑦ ملغي على شوبيفاي — blocked
  '53200': () => ({ ok:false, stage:'S1', stageAnalysis:{stage:'S1',conflict:false,unclear:true,signals:{}},
    order:{ id:'9002', orderId:'9002', name:'#53200' },
    profile:PROFILE({n:2,name:'#53200',s1:'Cancelled',ff:'UNFULFILLED',fin:'REFUNDED',
      cancelledAt:'2026-09-03T09:00:00Z',cancelReason:'CUSTOMER',
      li:[LI(2,2,0,'SD1-45'),LI(1,0,0,'MRX155-40')]}),
    eligibility:{ level:'blocked', code:'cancelled_on_shopify', title:'الأوردر ده ملغي على شوبيفاي',
      reason:'الأوردر اتلغى على شوبيفاي (السبب المسجّل: CUSTOMER) — مفيش أي حاجة تتغلّف فيه.', hints:[] },
    error:'الأوردر ده ملغي على شوبيفاي — الأوردر اتلغى على شوبيفاي (السبب المسجّل: CUSTOMER) — مفيش أي حاجة تتغلّف فيه.' }),
  // ⑧ اتشحن بالكامل — blocked/no_items بـ hints
  '53201': () => ({ ok:false, stage:'S1', stageAnalysis:{stage:'S1',conflict:false,unclear:true,signals:{}},
    order:{ id:'9003', orderId:'9003', name:'#53201' },
    profile:PROFILE({n:3,name:'#53201',s1:'Shipped',ff:'FULFILLED',
      li:[LI(2,2,0,'SD1-45'),LI(1,0,0,'MRX155-40')]}),
    eligibility:{ level:'blocked', code:'no_items', title:'مفيش أي قطعة تتغلّف في الأوردر ده',
      reason:'كل بنود الأوردر كميتها المتبقية للشحن صفر.',
      hints:['1 بند الكمية المتبقية فيه صفر والكمية الحالية أكبر من صفر — يعني اتشحن بالفعل.',
             '1 بند الكمية الحالية فيه صفر — يعني اترجّع أو اتلغى من الأوردر.'] },
    error:'مفيش أي قطعة تتغلّف في الأوردر ده — كل بنود الأوردر كميتها المتبقية للشحن صفر.' }),
  // ④ ما اتطبعش — warn بإقرار
  '53202': () => ({ ok:true, stage:'S1', stageAnalysis:{stage:'S1',conflict:false,unclear:false,signals:{}},
    order:{ id:'9004', orderId:'9004', name:'#53202', note:'' },
    items:[LI(1,1,1,'RN-AD-40')],
    profile:PROFILE({n:4,name:'#53202',s1:'Confirmed',p1:null,li:[LI(1,1,1,'RN-AD-40')]}),
    eligibility:{ level:'warn', code:'not_printed', title:'الأوردر ده ما اتطبعش',
      reason:'مفيش وقت طباعة مسجّل على المرحلة S1 — يعني الأوردر ده مش في طابور التغليف، والطرد هيتقفل من غير الفاتورة جوّاه.', hints:[] } }),
  // ⑪ مش موجود
  '99999': () => ({ ok:false, error:'الأوردر #99999 غير موجود' }),
};

// ⚠️ `PW_CHROMIUM` بيسمح بتمرير مسار كروميوم مثبّت مسبقًا — نفس اللي في
//    `sku-barcode-check.mjs`. من غيره الاختبار بيفشل لسبب مالوش علاقة
//    بالكود لو نسخة Playwright المثبّتة بتدوّر على build رقمه مختلف.
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext();
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('warehouse_ops_worker_secret', 'TEST-SECRET-1234567890');
    sessionStorage.setItem('woc_session', JSON.stringify(
      { v:1, username:'Ahmed_Ibraheem', displayName:'Ahmed Ibraheem', loginAt:new Date().toISOString() }));
  } catch {}
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

let lastCompleteBody = null;
await page.route('**/orders-packing-checker-worker.ecommoda-dev.workers.dev/**', async (route) => {
  const url = new URL(route.request().url());
  const action = url.searchParams.get('action');
  const J = (o, status = 200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(o) });

  if (action === 'get_config')       return J({ ok:true, version:'2.6.0' });
  if (action === 'get_employees')    return J({ ok:true, employees:[{ username:'Ahmed_Ibraheem', displayName:'Ahmed Ibraheem' }] });
  if (action === 'get_ready_orders') return J({ ok:true, total:0, orders:[], partial:false, s2Failed:[], s2Truncated:[] });
  if (action === 'get_logs')         return J({ ok:true, entries:[] });
  if (action === 'get_logs_count')   return J({ ok:true, total:0 });
  if (action === 'get_order') {
    const name = (url.searchParams.get('name') || url.searchParams.get('id') || '').replace('#','');
    const mk = ORDERS[name];
    return mk ? J(mk()) : J({ ok:false, error:`الأوردر #${name} غير موجود` });
  }
  if (action === 'complete_pack') {
    lastCompleteBody = JSON.parse(route.request().postData() || '{}');
    return J({ ok:true, status:'warning', stage:'S1', orderName:'#53197', logged:true,
      actions:['اتكتب s1_packed_by','اتكتب التاج S1=Packed'],
      warnings:['الأعمدة الإضافية ما اتكتبتش في D1'] });
  }
  return J({ ok:true });
});

await page.goto(`${BASE}/pack.html`, { waitUntil:'networkidle' });

// ⚠️ `#orderScanInput` هو مربع **دخول الأوردر** (ماسح شوبيفاي)، مش
//    `#barcodeScanInput` اللي هو مربع سكان **بنود** الأوردر جوّه شاشة
//    التشييك. الخلط بينهم بيخلّي الاختبار يعلّق على عنصر مخفي.
const scan = async (num) => {
  await page.fill('#orderScanInput', '');
  await page.fill('#orderScanInput', num);
  await page.press('#orderScanInput', 'Enter');
  await page.waitForTimeout(600);
};
const modalOpen  = () => page.locator('#packOutcomeModal:not(.hidden)').count().then(n => n > 0);
const modalText  = () => page.locator('#packOutcomeModal').innerText();
const closeModal = async () => { await page.locator('#poFooter button').last().click(); await page.waitForTimeout(250); };

console.log('\n① الأوردر المؤهل — الشاشة بتفتح ومفيش نافذة');
await scan('53197');
is(!(await modalOpen()), 'مفيش نافذة تشخيص على أوردر مؤهل');
is(await page.locator('#subscreenCheck').isVisible(), 'شاشة التشييك اتفتحت');
is(await page.locator('#btnOrderDetail').isVisible(), 'زرار «📋 تفاصيل الأوردر» ظاهر');
is(!(await page.locator('#unclearWarn').evaluate(e => e.classList.contains('show'))), 'مفيش بانر تحذير على أوردر مؤهل');

console.log('\n⑮ زرار «تفاصيل الأوردر» — ملف كامل بلا نداء Worker');
let calls = 0;
page.on('request', r => { if (r.url().includes('orders-packing-checker-worker')) calls++; });
await page.click('#btnOrderDetail'); await page.waitForTimeout(300);
is(await modalOpen(), 'النافذة اتفتحت من الزرار');
let t = await modalText();
is(t.includes('ملف الأوردر') && t.includes('#53197'), 'الملف فيه اسم الأوردر');
is(t.includes('حالة الشحن') && t.includes('الحالة المالية'), 'الحالتان معروضتان');
is(t.includes('بنود الأوردر') && t.includes('المتبقي للشحن'), 'جدول البنود بالكميات التلاتة');
is(calls === 0, 'صفر نداء للـ Worker من زرار التفاصيل', `اتنادى ${calls} مرة`);
await closeModal();
await page.click('button.btn-cancel-pack'); await page.waitForTimeout(300);

console.log('\n⑦ أوردر ملغي على شوبيفاي — حجب');
await scan('53200');
is(await modalOpen(), 'نافذة الحجب اتفتحت');
t = await modalText();
is(t.includes('ملغي على شوبيفاي'), 'العنوان بيسمّي السبب');
is(t.includes('CUSTOMER'), 'سبب الإلغاء معروض');
is(!(await page.locator('#subscreenCheck').isVisible()), '🔴 شاشة التغليف **ما اتفتحتش**');
is(await page.locator('#poHdr.is-blocked').count() > 0, 'الهيدر بلون الحجب');
await closeModal();

console.log('\n⑧ اتشحن بالكامل — «مفيش قطعة تتغلّف» بسبب مكتوب');
await scan('53201');
is(await modalOpen(), 'النافذة اتفتحت');
t = await modalText();
is(t.includes('مفيش أي قطعة تتغلّف'), 'العنوان صح');
is(t.includes('ليه مفيش شغل هنا؟'), 'قسم الأسباب موجود');
is(t.includes('اتشحن بالفعل') && t.includes('اترجّع أو اتلغى'), 'السببان مكتوبان بالاسم');
const cells = await page.locator('#packOutcomeModal .po-items tbody tr').count();
is(cells === 2, 'جدول البنود فيه صفّين (كل البنود مش النشطة بس)', `لقى ${cells}`);
is(await page.locator('#packOutcomeModal .po-q.q-live').count() === 0, 'مفيش أي كمية خضرا — كلهم صفر');
is(await page.locator('#packOutcomeModal .po-q.q-gone').count() === 1, 'بند واحد كميته الحالية صفر (أحمر)');
await closeModal();

console.log('\n④ ما اتطبعش — تحذير بإقرار');
await scan('53202');
is(await modalOpen(), 'نافذة التحذير اتفتحت');
t = await modalText();
is(t.includes('ما اتطبعش'), 'السبب مكتوب');
is(!(await page.locator('#subscreenCheck').isVisible()), 'الشاشة لسه ما اتفتحتش قبل الإقرار');
const goBtn = page.locator('#poFooter button').last();
is(await goBtn.isDisabled(), '🔴 زرار المتابعة **متعطّل** قبل ما المربع يتعلّم');
await page.check('#poAckCb'); await page.waitForTimeout(150);
is(!(await goBtn.isDisabled()), 'اتفعّل بعد الإقرار');
await goBtn.click(); await page.waitForTimeout(400);
is(await page.locator('#subscreenCheck').isVisible(), 'الشاشة اتفتحت بعد الإقرار');
is(await page.locator('#unclearWarn').evaluate(e => e.classList.contains('show')), '🔴 البانر الأصفر **فاضل** على الشاشة');
const warnTxt = await page.locator('#unclearWarn').innerText();
is(warnTxt.includes('ما اتطبعش'), 'البانر بيسمّي الحالة الفعلية مش جملة عامة', warnTxt.slice(0,90));
is(!warnTxt.includes('لم يتم تحديد حالة الأوردر'), 'النص القديم الغلط اتشال');

console.log('\n⑫ الإقرار بيتبعت للـ Worker');
await page.evaluate(() => { currentItems.forEach(i => i.scanned = i.quantity); updateSummary(); updateCompleteBtn(); });
await page.waitForTimeout(200);
await page.click('#btnComplete'); await page.waitForTimeout(600);
is(lastCompleteBody && lastCompleteBody.eligibilityAck === true, '🔴 `eligibilityAck: true` اتبعت في جسم `complete_pack`',
   JSON.stringify(lastCompleteBody || {}).slice(0,140));

console.log('\n⑩ تغليف جزئي — نافذة مش توست، واللوحة فاضلة');
is(await modalOpen(), 'نافذة «تم جزئيًا» اتفتحت');
t = await modalText();
is(t.includes('تم جزئيًا'), 'العنوان صح');
is(t.includes('ما تم فعليًا') && t.includes('التحذيرات'), 'القايمتان معروضتان');
is(await page.locator('#packResultPanel').isVisible(), '🔴 لوحة النتيجة تحت **فاضلة** مع النافذة');
is(await page.locator('.toast').count() === 0, '🔴 مفيش توست مع النافذة — رسالة واحدة للحدث');
await closeModal();
await page.click('button.btn-cancel-pack'); await page.waitForTimeout(300);

console.log('\n⑪ أوردر مش موجود — نافذة والفوكس بيرجع للمربع');
await scan('99999');
is(await modalOpen(), 'النافذة اتفتحت بدل التوست');
t = await modalText();
is(t.includes('غير موجود'), 'رسالة الـ Worker معروضة كما هي');
is(!t.includes('ملف الأوردر'), 'مفيش ملف — الـ Worker ما رجّعش واحد');
await closeModal();
is(await page.evaluate(() => document.activeElement?.id) === 'orderScanInput',
   '🔴 الفوكس رجع لمربع دخول الأوردر بعد الإغلاق');

console.log('\n⑤ الضغط برّه النافذة مايقفلهاش');
await scan('53200');
await page.mouse.click(5, 5); await page.waitForTimeout(250);
is(await modalOpen(), '🔴 النافذة **لسه مفتوحة** بعد الضغط برّه');
await closeModal();
is(!(await modalOpen()), 'وبتتقفل بالزرار');

console.log('\n— الكونسول —');
is(errors.length === 0, 'صفر خطأ JS', errors.join(' | ').slice(0, 300));

await browser.close();
server.close();
console.log(`\n${fail ? '❌' : '✅'} النتيجة: ${pass} عدّى · ${fail} فشل\n`);
process.exit(fail ? 1 : 0);
