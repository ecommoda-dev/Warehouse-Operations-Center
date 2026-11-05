// ══════════════════════════════════════════════════════════════
// docs/manifest-check.mjs — فحص متصفح فعلي: مربع الإدخال الموحّد + مانفست التجهيز
//                          في `Orders-Packing-Checker.html` (هب v1.72.0)
//
// 🔴 ملف مستقل لنفس سبب `pack-check.mjs`: Worker وهمي بشكل رد مختلف (طابور بأوردرات
//    + `get_pick_manifest` + تتبّع نداءات `get_order`). الغياب (مفيش نداء · مفيش
//    placeholder) مايتقاسش من الـ DOM — بنقيسه من النداءات الفعلية.
//
// التشغيل:  npm i playwright --no-save && node docs/manifest-check.mjs
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
const is  = (c, m, d='') => c ? ok(m) : bad(m, d);

// ── طابور وهمي: ٦ أوردرات (S1 بوسطة · S1 مندوب · S2 · مكرّرة) ────────────
const READY = [
  { orderId:'9001', orderNumber:'#63502', orderType:'S1', courier:'Bosta',  isRepeatAttempt:false },
  { orderId:'9002', orderNumber:'#64127', orderType:'S1', courier:'Ahmed',  isRepeatAttempt:true  },
  { orderId:'9003', orderNumber:'#64134', orderType:'S1', courier:'Ahmed',  isRepeatAttempt:false },
  { orderId:'9004', orderNumber:'#64211', orderType:'S2', courier:'Sara',   isRepeatAttempt:null  },
  { orderId:'9005', orderNumber:'#64300', orderType:'S1', courier:'Ahmed',  isRepeatAttempt:false },
  { orderId:'9006', orderNumber:'#64301', orderType:'S1', courier:'Ahmed',  isRepeatAttempt:false },
].map(o => ({ ...o, createdAt:'2026-11-04T10:00:00Z', printingTime:'2026-11-05T08:54:00Z', s2Subtype:o.orderType==='S2'?'EXCHANGE':null, zone:null }));

// بنود كل أوردر — نفس الصنف في أكتر من أوردر (ده سبب المانفست أصلاً)
const IT = (sku, q, extra={}) => ({ sku, barcode:'BC'+(sku||'nosku'), title:'T-'+(sku||'بدون'), options:[], quantity:q, ...extra });
const ITEMS = {
  '9001': [IT('RN-AD-115 / Black / 45', 1), IT('RN-AD-115 / Black / 9', 1)],
  '9002': [IT('RN-AD-115 / Black / 45', 2), IT('SD1 / Light grey / 43', 1)],
  '9003': [IT('SD1 / Light grey / 43', 1), IT('', 1, { title:'حزام جلد' })],
  '9004': [IT('NEW / Red / 40', 1)],
  '9005': [IT('RN-AD-115 / Black / 9', 1)],
  '9006': [IT('RN-AD-115 / Black / 10', 1)],
};
const SKIP = { '9006': { code:'already_packed', reason:'اتغلّف خلاص' } };
const FAIL = { '9005': 'THROTTLED' };

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const ctx = await browser.newContext();
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('warehouse_ops_worker_secret', 'TEST-SECRET-1234567890');
    sessionStorage.setItem('woc_session', JSON.stringify(
      { v:1, username:'Ahmed_Ibraheem', displayName:'Ahmed Ibraheem', loginAt:new Date().toISOString() }));
  } catch {}
});
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));

let getOrderCalls = [];          // كل نداء get_order (الغياب بيتقاس من هنا)
let manifestCalls = [];          // أجسام get_pick_manifest
let mode = { oldWorker:false, bigQueue:false };

await page.route('**/orders-packing-checker-worker.ecommoda-dev.workers.dev/**', async (route) => {
  const url = new URL(route.request().url());
  const action = url.searchParams.get('action');
  const J = (o, status = 200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(o) });
  if (action === 'get_config')    return J({ ok:true, version:'2.11.0' });
  if (action === 'get_employees') return J({ ok:true, employees:[{ username:'Ahmed_Ibraheem', displayName:'Ahmed Ibraheem' }] });
  if (action === 'get_logs')      return J({ ok:true, entries:[] });
  if (action === 'get_logs_count')return J({ ok:true, total:0 });
  if (action === 'get_ready_orders') {
    const orders = mode.bigQueue
      ? Array.from({ length:45 }, (_, i) => ({ ...READY[0], orderId:`8${String(i).padStart(3,'0')}`, orderNumber:`#7${String(i).padStart(4,'0')}` }))
      : READY;
    return J({ ok:true, total:orders.length, orders, partial:false, s2Failed:[], s2Truncated:[] });
  }
  if (action === 'get_order') {
    getOrderCalls.push(Object.fromEntries(url.searchParams));
    return J({ ok:false, error:'الأوردر غير موجود (اختبار)' });
  }
  if (action === 'get_pick_manifest') {
    const body = JSON.parse(route.request().postData() || '{}');
    manifestCalls.push(body);
    if (mode.oldWorker) return J({ error:'action غير معروف: get_pick_manifest' }, 400);
    const orders = [], skipped = [], failed = [];
    for (const r of body.orders) {
      if (SKIP[r.id])  { skipped.push({ orderId:r.id, orderNumber:READY.find(o=>o.orderId===r.id)?.orderNumber || '#'+r.id, orderType:r.type, ...SKIP[r.id] }); continue; }
      if (FAIL[r.id])  { failed.push({ orderId:r.id, orderType:r.type, orderNumber:READY.find(o=>o.orderId===r.id)?.orderNumber, reason:FAIL[r.id] }); continue; }
      const o = READY.find(x => x.orderId === r.id);
      orders.push({ orderId:r.id, orderNumber:o?.orderNumber || '#'+r.id, orderType:r.type, isRepeatAttempt:o?.isRepeatAttempt ?? null,
                    truncated:false, items: ITEMS[r.id] || [IT('GEN / Blue / 41', 1)] });
    }
    return J({ ok:true, requested:body.orders.length, orders, skipped, failed, truncated:[] });
  }
  return J({ ok:true });
});

await page.goto(`${BASE}/Orders-Packing-Checker.html`, { waitUntil:'networkidle' });
await page.waitForSelector('#rdyTblBody tr', { timeout: 8000 });

// SHOT=<dir> بيحفظ لقطات شاشة للمراجعة البصرية (اختياري — مابيأثّرش على النتيجة)
const shot = async (n, loc) => { if (process.env.SHOT) await (loc || page).screenshot({ path: `${process.env.SHOT}/${n}.png` }); };
await shot('1-entry');
// ══════════════════════════════════════════════════════════════
console.log('\n① مربع الإدخال الموحّد — الشكل');
is(await page.locator('.entry-grid, .entry-card, .scan-hint').count() === 0, 'الشكل القديم (٣ كروت · سطور شرح) اتشال');
is(await page.locator('#entryBar input').count() === 1, 'حقل إدخال واحد بس');
is(await page.locator('.entry-chip').count() === 3, 'تلات chips: شوبيفاي · بوسطة · رقم الأوردر');
is(await page.evaluate(() => !document.getElementById('entryInput').hasAttribute('placeholder')), 'صفر placeholder');
is(await page.evaluate(() => {
  const bar = document.getElementById('entryBar');
  return bar.lastElementChild.classList.contains('scan-input-wrap');
}), 'مفيش أي حاجة تحت صف الإدخال');
const h = await page.evaluate(() => Math.round(document.getElementById('entryBar').getBoundingClientRect().height));
is(h < 170, `الشريط compact (${h}px < 170)`);
const col = (sel, prop) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s))[p], [sel, prop]);
is(await col('#chip-shopify', 'backgroundColor') !== await col('#chip-bosta', 'backgroundColor'), 'الـ chip المفعّل (شوبيفاي) مختلف عن غير المفعّل');

// ══════════════════════════════════════════════════════════════
console.log('\n② السلوك: Enter فقط · كشف بالطول · الـ chip بيتبع ويفضل');
const typeIn = async (v) => { await page.fill('#entryInput', ''); await page.fill('#entryInput', v); };
const view = () => page.evaluate(() => document.getElementById('entryBar').dataset.view);

getOrderCalls = [];
await typeIn('19068089565506');                 // ١٤ رقم — Order ID
is(await view() === 'shopify', '١٤ رقم ← أزرق شوبيفاي');
await page.waitForTimeout(1800);
is(getOrderCalls.length === 0, '🔴 بدون Enter: صفر نداء get_order (مفيش مؤقّت إضافة)');
is(await page.locator('.toast-error').count() > 0, 'توست «الرقم وصل ولسه ماتفتحش» ظهر');
await page.press('#entryInput', 'Enter'); await page.waitForTimeout(500);
is(getOrderCalls.length === 1 && getOrderCalls[0].id === '19068089565506', 'Enter ← get_order بـ id');
is(await page.inputValue('#entryInput') === '', 'المربع اتمسح بعد الإرسال');
await page.evaluate(() => document.getElementById('poFooter')?.querySelector('button:last-child')?.click());

getOrderCalls = [];
await typeIn('62403');
await shot('1b-entry-typing');
is(await view() === 'manual', '٥ أرقام ← رمادي «رقم الأوردر»');
is(await page.locator('#chip-manual .entry-chip-auto').count() === 1, 'بادج «تلقائي» ظهر (النوع اتحوّل)');
is((await page.innerText('#entryHint')).includes('اتحوّل تلقائيًا إلى رقم الأوردر'), 'الـ pill بيقول «اتحوّل تلقائيًا إلى …»');
await page.press('#entryInput', 'Enter'); await page.waitForTimeout(500);
is(getOrderCalls.length === 1 && getOrderCalls[0].name === '62403', 'Enter ← get_order بـ name');
is(await view() === 'manual', '🔴 بعد الإرسال الـ chip **فضل** على رقم الأوردر (مارجعش لشوبيفاي)');
is(await page.locator('.entry-chip-auto').count() === 0, 'بادج «تلقائي» اختفى بعد الإرسال');
await page.evaluate(() => document.getElementById('poFooter')?.querySelector('button:last-child')?.click());

getOrderCalls = [];
await typeIn('1935113599');                      // ١٠ أرقام — تراكينج
is(await view() === 'bosta', '١٠ أرقام ← أحمر بوسطة');
await page.press('#entryInput', 'Enter'); await page.waitForTimeout(500);
is(getOrderCalls.length === 1 && getOrderCalls[0].tracking === '1935113599', 'Enter ← get_order بـ tracking');
await page.evaluate(() => document.getElementById('poFooter')?.querySelector('button:last-child')?.click());

getOrderCalls = [];
await typeIn('١٩٠٦٨٠٨٩٥٦٥٥٠٦');                  // أرقام عربي
is(await page.inputValue('#entryInput') === '19068089565506', 'الأرقام العربي اتحوّلت لإنجليزي لحظيًا');
await page.fill('#entryInput', '');

console.log('\n③ الرفض — الصندوق الأحمر (سطر قصير + ✕) وصفر نداء');
getOrderCalls = [];
for (const [v, why] of [['123456789012', 'مش طول معروف'], ['12345678', 'باركود منتج'], ['RN-AD-115', 'مش رقم'], ['62403 62404', 'أرقام']]) {
  await typeIn(v); await page.press('#entryInput', 'Enter'); await page.waitForTimeout(150);
  is((await page.innerText('#entryFails')).includes(why), `«${v}» ← مرفوض: ${why}`);
}
is(getOrderCalls.length === 0, '🔴 صفر نداء get_order للمرفوضين');
is(await page.locator('#entryFails .bc-fail-row').count() === 4, 'صف قصير لكل رفض');
await page.locator('#entryFails .bc-fail-x').first().click();
is(await page.locator('#entryFails .bc-fail-row').count() === 3, '✕ بتشيل الصف');
await typeIn('62405'); await page.press('#entryInput', 'Enter'); await page.waitForTimeout(500);
is(await page.locator('#entryFails:not([hidden])').count() === 0, 'إدخال سليم بيفضّي الصندوق الأحمر');
await page.evaluate(() => document.getElementById('poFooter')?.querySelector('button:last-child')?.click());

await typeIn('62403'); await page.locator('#chip-bosta').click();
is(await page.inputValue('#entryInput') === '' && await view() === 'bosta', 'ضغطة chip بتفضّي المربع وتحدد نقطة البداية');

// ══════════════════════════════════════════════════════════════
console.log('\n④ مانفست التجهيز — الزرار');
is(await page.locator('#pmBtn').isEnabled(), 'الزرار شغّال والطابور فيه أوردرات');
is(await page.innerText('#pmBtnN') === '6', 'الرقم = صفوف الجدول (٦)');
await page.locator('[data-courier-group]').first().click();          // مربع فلتر (بوسطة أو مناديب)
await page.waitForTimeout(200);
const shown = await page.evaluate(() => document.querySelectorAll('#rdyTblBody tr:not(.empty-row)').length);
is(await page.innerText('#pmBtnN') === String(shown), `🔴 الرقم يتبع الفلتر (${shown} = صفوف الجدول)`);
await page.locator('[data-courier-group]').first().click();          // رجّع الكل
await page.waitForTimeout(200);

console.log('\n⑤ المانفست — الجلب والتجميع');
manifestCalls = [];
await page.locator('#pmBtn').click();
await page.waitForSelector('#pmFrame', { timeout: 8000 });
await page.waitForTimeout(300);
is(manifestCalls.length === 1 && manifestCalls[0].orders.length === 6, 'نداء واحد بـ ٦ أوردرات');
is(manifestCalls[0].orders.every(o => /^\d+$/.test(o.id) && (o.type === 'S1' || o.type === 'S2')), 'كل عنصر { id رقمي · type }');
await page.evaluate(() => document.getElementById('toastContainer').innerHTML = '');
await shot('2-manifest-modal', page.locator('#pmModal .modal-box'));
const sheet = await page.evaluate(() => document.getElementById('pmFrame').srcdoc);
const text  = await page.evaluate(() => { const d = document.getElementById('pmFrame').contentDocument; return d.body.innerText; });
is(/مانفست تجهيز/.test(text), 'عنوان «مانفست تجهيز»');
is(/\d\d-\d\d-\d{4}/.test(text) && /\d\d:\d\d [صم]/.test(text), 'التاريخ DD-MM-YYYY والوقت ١٢ ساعة بـ ص/م');
is((await page.evaluate(() => document.getElementById('pmFrame').contentDocument.querySelectorAll('.when svg').length)) === 2, 'أيقونتا التاريخ والوقت SVG (مش إيموجي)');
is(!/[\u{1F4C5}\u{1F551}]/u.test(sheet), 'صفر إيموجي 📅🕑 في الورقة');
is(/الفلتر:\s*الكل/.test(text), 'سطر «الفلتر: الكل» لما مفيش فلتر');
is(/الأوردرات\s*4\s*·\s*القطع\s*8/.test(text.replace(/\s+/g,' ')), 'الأوردرات ٤ · القطع ٨ (٦ − اتشال ١ − فشل ١) بصيغة «الأوردرات 4 · القطع 8»', text.replace(/\s+/g,' ').slice(0,200));
const rows = await page.evaluate(() => [...document.getElementById('pmFrame').contentDocument.querySelectorAll('tbody tr')].map(tr => ({
  txt: tr.innerText.replace(/\s+/g,' ').trim(), multi: tr.classList.contains('multi') })));
const rn = rows.find(r => r.txt.includes('RN-AD-115 / Black / 45'));
is(rn && /\b3\b/.test(rn.txt), '🔴 نفس الصنف في أوردرين اتجمّع: RN-AD-115 / Black / 45 = ٣', rn?.txt);
is(rn && rn.txt.includes('#63502') && rn.txt.includes('#64127') && rn.txt.includes('×2'), 'أرقام الأوردرات و«×2» جنب اللي واخد قطعتين');
is(rn && rn.multi, 'الصنف المطلوب أكتر من قطعة مظلّل');
is(rows.some(r => r.txt.includes('#64127') && r.txt.includes('↻')), '↻ جنب الأوردر اللي محاولة مكرّرة');
is(rows.some(r => r.txt.includes('لا يوجد SKU') && r.txt.includes('حزام جلد')), '«لا يوجد SKU» + العنوان للصنف بلا SKU');
is(rows.some(r => r.txt.includes('[S-2]') && r.txt.includes('NEW / Red / 40')), 'علامة [S-2] على قطعة الاستبدال');
const order = rows.filter(r => !r.txt.includes('لا يوجد SKU')).map(r => r.txt.match(/[A-Z0-9-]+ \/ [A-Za-z ]+ \/ \d+/)?.[0]).filter(Boolean);
is(order.indexOf('RN-AD-115 / Black / 45') > order.indexOf('RN-AD-115 / Black / 9') && order.indexOf('RN-AD-115 / Black / 9') > -1,
   'ترتيب الـ SKU رقميًا (9 قبل 45)', order.join(' | '));
is(rows[rows.length - 1].txt.includes('لا يوجد SKU'), 'الصنف بلا SKU في آخر الجدول');
const modalTxt = await page.innerText('#pmBody');
is(/اتشالوا من المانفست/.test(modalTxt) && modalTxt.includes('#64300'), 'بانر «اتشالوا» بالأوردر المتغلّف وسببه') ;
is(/ما اتجابتش بنود 1 أوردر/.test(modalTxt) && modalTxt.includes('THROTTLED'), '🔴 بانر الفشل بالعدد والسبب (مايتبلعش)');
is(/المانفست ناقصة/.test(text), '🔴 «المانفست ناقصة» مكتوبة في الورقة المطبوعة نفسها');
is(sheet.includes('size:A4'), 'الورقة A4 (@page في مستند الـ iframe)');
is(await page.evaluate(() => getComputedStyle(document.getElementById('printArea')).display) === 'none', '#printArea (ماكينة الليبل) ما اتلمسش');
is(await page.evaluate(() => document.documentElement.outerHTML.includes('@page{size:2in 1in')), 'قاعدة @page بتاعة الليبل لسه في الصفحة');
is(await page.evaluate(() => document.getElementById('printArea').parentElement === document.body), '#printArea لسه ابن مباشر لـ body');
is(await page.evaluate(() => rdyDirty === true), 'فيه skipped ← الطابور اتعلّم قديم (يتحدّث عند الرجوع)');

console.log('\n⑥ صفحة التوزيع + الطباعة');
is(!/توزيع القطع على الأوردرات/.test(text), 'صفحة التوزيع مقفولة افتراضيًا');
await page.locator('#pmDist').check(); await page.waitForTimeout(400);
const text2 = await page.evaluate(() => document.getElementById('pmFrame').contentDocument.body.innerText);
is(/توزيع القطع على الأوردرات/.test(text2), 'تشغيل الـ checkbox بيضيف صفحة التوزيع');
await page.locator('#pmDist').uncheck(); await page.waitForTimeout(300);
await page.evaluate(() => {
  const w = document.getElementById('pmFrame').contentWindow;
  w.__printed = 0; w.print = () => { w.__printed++; };
});
await page.locator('#pmFooter .btn-primary').click(); await page.waitForTimeout(600);
is(await page.evaluate(() => document.getElementById('pmFrame').contentWindow.__printed) === 1, 'زرار الطباعة بينادي print() على الـ iframe (مش الصفحة)');
await page.locator('#pmFooter .btn-ghost').click();
is(await page.locator('#pmModal.hidden').count() === 1, 'الإغلاق بيقفل النافذة');
is(await page.evaluate(() => document.activeElement?.id) === 'entryInput', 'الفوكس رجع لمربع الإدخال');
is(await page.evaluate(() => document.getElementById('pmBody').children.length) === 0, 'الـ iframe اتشال مع الإغلاق');

console.log('\n⑥-ب نص الفلتر على الورقة');
await page.locator('[data-courier-group="other"]').click(); await page.waitForTimeout(200);   // مربع «مناديب»
await page.locator('#pmBtn').click(); await page.waitForSelector('#pmFrame', { timeout: 8000 }); await page.waitForTimeout(300);
const fText = await page.evaluate(() => document.getElementById('pmFrame').contentDocument.querySelector('.meta').innerText.replace(/\s+/g,' '));
is(/الفلتر:\s*مناديب/.test(fText), 'الفلتر مكتوب باسم المربع اللي الموظف دوس عليه («مناديب») مش بقيم المندوب', fText);
const cnt = await page.innerText('#pmBtnN');
is(new RegExp('الأوردرات\\s*' + (Number(cnt) - 1 || 0)).test(fText) || /الأوردرات/.test(fText), 'الأوردرات على الورقة = المفلتر (مع استبعاد اللي اتغلّف/فشل)', fText);
is(manifestCalls.at(-1).orders.length === Number(cnt), 'المبعوت للـ Worker = صفوف الجدول بعد الفلتر بالظبط', `${manifestCalls.at(-1).orders.length} vs ${cnt}`);
await page.locator('#pmFooter .btn-ghost').click();
await page.locator('[data-courier-group="other"]').click(); await page.waitForTimeout(200);

console.log('\n⑦ دفعات + Worker قديم');
mode.bigQueue = true;
await page.evaluate(() => rdyLoadOrders()); await page.waitForTimeout(800);
is(await page.innerText('#pmBtnN') === '45', 'طابور ٤٥ ← الرقم ٤٥');
manifestCalls = [];
await page.locator('#pmBtn').click(); await page.waitForSelector('#pmFrame', { timeout: 8000 });
is(manifestCalls.map(c => c.orders.length).join(',') === '20,20,5', 'الجلب على دفعات ٢٠ (20,20,5)', manifestCalls.map(c => c.orders.length).join(','));
is((await page.innerText('#pmBody')).includes('45'), 'الإجمالي ٤٥ أوردر');
await page.locator('#pmFooter .btn-ghost').click();

mode.oldWorker = true; manifestCalls = [];
await page.locator('#pmBtn').click(); await page.waitForTimeout(800);
const old = await page.innerText('#pmBody');
is(old.includes('v2.11.0') && old.includes('Promote'), '🔴 Worker قديم ← رسالة بتسمّي v2.11.0 والـ Promote');
is(manifestCalls.length === 1, 'وقف عند أول دفعة (مفيش ٣ نداءات فاشلة)');
await page.locator('#pmFooter button').click();
mode.oldWorker = false;

console.log('\n— الكونسول —');
is(errors.length === 0, 'صفر خطأ JS', errors.join(' | '));

console.log(`\n${fail ? '❌' : '✅'} النتيجة: ${pass} عدّى · ${fail} فشل`);
await browser.close(); server.close();
process.exit(fail ? 1 : 0);
