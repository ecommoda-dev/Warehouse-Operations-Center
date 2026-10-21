// فحص الخروج التلقائي لعدم النشاط (Standards #52) — متصفح فعلي (Playwright). جديد v1.43.0.
//   npm i playwright --no-save && node docs/idle-check.mjs
//   PW_CHROMIUM=<مسار كروميوم مثبّت> لو Playwright ما نزّلش نسخته.
// نسخة من `Delivery-COD-Operations-Center/docs/idle-check.mjs` على أسماء المخزن (`woc_*`).
// بيغطي: خروج فوري بعد 60 د + إشعار · بانر التحذير بنصوصه وz-index 9000 · mousemove مش نشاط ·
// «أنا موجود» · خروج يدوي بلا confirm · حارس الدفعة (shellIsBusy) في الجرد والمكتب والمرتجعات.
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' }); r.end(fs.readFileSync(f));
}).listen(0);
const base = `http://localhost:${srv.address().port}`;
const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✅' : '  ❌', m); };
async function mk(lastMinAgo) {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  const calls = []; p.on('dialog', d => { calls.push('dialog'); d.dismiss(); });
  await p.route(/workers\.dev/, rt => { calls.push(new URL(rt.request().url()).searchParams.get('action')); rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, orders: [], rows: [], entries: [], version: '99.9.9' }) }); });
  await p.addInitScript(m => {
    if (sessionStorage.getItem('woc_session') === null && !location.search.includes('reason')) {
      sessionStorage.setItem('woc_session', JSON.stringify({ v: 1, username: 'u', displayName: 'أحمد', loginAt: new Date().toISOString() }));
      sessionStorage.setItem('woc_last_activity', String(Date.now() - m * 60000));
      localStorage.setItem('warehouse_ops_worker_secret', 'x');
    }
  }, lastMinAgo);
  return { p, calls };
}
console.log('① 61 دقيقة → خروج فوري بإشعار');
{ const { p } = await mk(61); await p.goto(base + '/Order-Item-Remover.html'); await p.waitForURL(/index\.html\?reason=idle/, { timeout: 8000 }).catch(() => {});
  ok(/index\.html\?reason=idle/.test(p.url()), 'اتحوّل لـ index.html?reason=idle');
  await p.waitForSelector('#loginNotice.visible', { timeout: 5000 }).catch(() => {});
  ok((await p.textContent('#loginNotice')).includes('تم تسجيل خروج تلقائي لعدم النشاط'), 'الإشعار على شاشة الدخول');
  ok(await p.evaluate(() => sessionStorage.getItem('woc_session') === null), 'الجلسة اتمسحت');
  ok(await p.evaluate(() => sessionStorage.getItem('woc_last_activity') === null), 'ومفتاح آخر نشاط اتمسح');
}
console.log('② 59.3 دقيقة → بانر تحذير بالنصوص المعتمدة');
{ const { p } = await mk(59.3); await p.goto(base + '/Order-Item-Remover.html'); await p.waitForSelector('#idleWarn.visible', { timeout: 5000 }).catch(() => {});
  const t = await p.textContent('#idleWarn').catch(() => '');
  ok(/سيتم تسجيل الخروج لعدم النشاط بعد \d+ ثانية/.test(t), 'السطر الأول'); ok(t.includes('هل أنت موجود يا أحمد؟'), 'السطر التاني بالاسم');
  ok(await p.evaluate(() => +getComputedStyle(document.getElementById('idleWarn')).zIndex === 9000), 'z-index 9000');
  const before = await p.evaluate(() => +sessionStorage.getItem('woc_last_activity'));
  await p.mouse.move(50, 50); await p.mouse.move(120, 90);
  ok(await p.evaluate(() => document.getElementById('idleWarn').classList.contains('visible')), 'حركة الماوس مش نشاط');
  await p.click('#idleWarnBtn');
  ok(!(await p.evaluate(() => document.getElementById('idleWarn').classList.contains('visible'))), '«أنا موجود» بيخفي البانر');
  ok(await p.evaluate(b => +sessionStorage.getItem('woc_last_activity') > b + 30 * 60000, before), 'والنشاط اتجدّد');
}
console.log('③ الخروج اليدوي بلا تأكيد + حارس الدفعة');
{ const { p, calls } = await mk(1); await p.goto(base + '/Order-Item-Remover.html'); await p.waitForSelector('#activeUserBtn');
  await p.evaluate(() => { window.shellIsBusy = () => true; }); await p.click('#activeUserBtn');
  ok(p.url().includes('Order-Item-Remover'), 'دفعة شغّالة → ما خرجش'); ok(await p.evaluate(() => /دفعة/.test(document.body.innerText)), 'توست الدفعة');
  await p.evaluate(() => { window.shellIsBusy = () => false; }); await p.click('#activeUserBtn');
  await p.waitForURL(/index\.html$/, { timeout: 8000 }).catch(() => {});
  ok(/index\.html$/.test(p.url()), 'خرج لـ index.html بلا ?reason'); ok(!calls.includes('dialog'), 'صفر confirm/dialog'); ok(calls.includes('log_logout'), 'log_logout اتنادى');
  ok(await p.evaluate(() => !document.getElementById('loginNotice').classList.contains('visible')), 'بلا إشعار على الخروج اليدوي');
}
console.log('④ حارس الدفعة في الصفحات اللي فيها شغل جاري');
{ // الجرد: جلسة فيها مسحات ما اتنفّذتش = مشغول (وإلا ساعة عدّ بتضيع)
  const { p } = await mk(59.96); await p.goto(base + '/Inventory-Audit-Updater.html'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => typeof window.shellIsBusy === 'function' && window.shellIsBusy() === false), 'الجرد: فاضي → مش مشغول');
  await p.evaluate(() => { bulkScans.set('X1', { n: 1 }); }); await p.waitForTimeout(4500);
  ok(/Inventory-Audit-Updater/.test(p.url()), 'الجرد: مسحات ما اتنفّذتش → ماخرجش بعد انتهاء المدة');
  ok(await p.evaluate(() => !document.getElementById('idleWarn')?.classList.contains('visible')), 'والبانر مخفي');
  ok(await p.evaluate(() => Date.now() - +sessionStorage.getItem('woc_last_activity') < 60000), 'آخر نشاط اتجدّد وهو مشغول'); }
{ const { p } = await mk(61); await p.goto(base + '/Inventory-Audit-Updater.html'); await p.waitForURL(/index\.html\?reason=idle/, { timeout: 8000 }).catch(() => {});
  ok(/reason=idle/.test(p.url()), 'الجرد بلا مسحات + ٦١ دقيقة → خروج'); }
{ for (const pg of ['Package-Transfer-To-Office.html', 'Package-Transfer-To-Warehouse.html']) {
    const { p } = await mk(1); await p.goto(base + '/' + pg); await p.waitForTimeout(500);
    ok(await p.evaluate(() => window.shellIsBusy() === false), pg + ': مفيش سكانة → مش مشغول');
    await p.evaluate(() => { scanBusy = true; });
    ok(await p.evaluate(() => window.shellIsBusy() === true), pg + ': سكانة بتتسجّل → مشغول'); } }
console.log(`\nالنتيجة: ${pass} عدّى · ${fail} فشل`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
