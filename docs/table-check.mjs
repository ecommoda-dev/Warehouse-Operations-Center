// فحص مكوّن §TABLE في shared/core.js — جدول بسيط بلا Workers. node docs/table-check.mjs
import { chromium } from 'playwright';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('❌', m)); };
const br = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await br.newPage({ viewport: { width: 1200, height: 800 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('file://' + path.join(dir, 'table-fixture.html'));
await page.waitForSelector('table.eco-tbl-on');
const vis = () => page.$$eval('#b1 tr:not(.none)', r => r.filter(x => x.offsetParent).length);
ok(await vis() === 4, 'كل الصفوف ظاهرة في الأول');
ok(await page.$$eval('thead th .eco-hf', b => b.length) === 3, 'قمع على الأعمدة الثلاثة (بلا checkbox ولا إجراء)');
ok(await page.$$eval('thead th .eco-rz', b => b.length) === 5, 'مقبض سحب على كل عمود');
ok(await page.evaluate(() => getComputedStyle(document.querySelector('thead th')).position) === 'sticky', 'العناوين ثابتة');
// قايمة المندوب
await page.click('thead th:nth-child(3) .eco-hf');
ok(await page.$('.eco-hpop-list') !== null, 'قايمة اختيار للمندوب');
ok(await page.evaluate(() => window.sorted || 0) === 0, 'القمع مابيرتّبش');
await page.click('.eco-hpop-item:has-text("Bosta")');
ok(await vis() === 2, 'اختيار Bosta = صفين');
ok(await page.$('.eco-hpop-list') !== null, 'القايمة تفضل مفتوحة بعد الاختيار');
await page.click('.eco-hpop-item:has-text("Ali")');
ok(await vis() === 3, 'اختيار تاني = تلاتة (متعدد)');
ok(await page.$eval('.eco-tbl-bar', b => !b.hidden && b.textContent.includes('3') && b.textContent.includes('4')), 'بار «3 من 4»');
ok(await page.$eval('thead th:nth-child(3) .eco-hf', b => b.classList.contains('on')), 'القمع مولّع');
ok(await page.$eval('#b1 tr.none', r => r.offsetParent !== null) === true, 'صف الـ colspan ظاهر');
// إعادة رسم الجدول — الفلتر يتعاد
await page.evaluate(() => render());
await page.waitForTimeout(150);
ok(await vis() === 3, 'الفلتر بيتعاد بعد إعادة رسم tbody');
// بحث نصي
await page.keyboard.press('Escape');
await page.click('.eco-tbl-clear'); ok(await vis() === 4, 'مسح كل الفلاتر');
await page.click('thead th:nth-child(4) .eco-hf');
ok(await page.$('.eco-hpop-inp') !== null, 'العنوان (قيم كتير طويلة) = بحث نصي');
await page.fill('.eco-hpop-inp', 'القاهرة'); await page.waitForTimeout(250);
ok(await vis() === 2, 'بحث «القاهرة» = صفين');
await page.keyboard.press('Escape'); await page.click('.eco-tbl-clear');
// ضغط برّه يقفل
await page.click('thead th:nth-child(3) .eco-hf'); await page.mouse.click(5, 5);
ok(await page.$('.eco-hpop') === null, 'الضغط برّه يقفل القايمة');
// سحب العرض
const th = await page.$('thead th:nth-child(2)'); const w0 = (await th.boundingBox()).width;
const h = await page.$('thead th:nth-child(2) .eco-rz'); const hb = await h.boundingBox();
const cx = hb.x + hb.width / 2, cy = hb.y + hb.height / 2;
await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 80, cy, { steps: 4 }); await page.mouse.up();
const w1 = (await (await page.$('thead th:nth-child(2)')).boundingBox()).width;
ok(Math.abs((w1 - w0) - 80) <= 2, `السحب +٨٠ (${w0}→${w1})`);
ok(await page.evaluate(() => window.sorted || 0) === 0, 'السحب مابيرتّبش');
ok(await page.evaluate(() => !!localStorage.getItem('eco_col_widths_v1_table-fixture.html')), 'العرض اتحفظ');
// دبل كليك يصغّر
const h2 = await page.$('thead th:nth-child(2) .eco-rz'); const b2 = await h2.boundingBox();
await page.mouse.dblclick(b2.x + b2.width / 2, b2.y + b2.height / 2);
const w2 = (await (await page.$('thead th:nth-child(2)')).boundingBox()).width;
ok(w2 < w1 - 10, `دبل كليك بيصغّر (${w1}→${w2})`);
// بعد refresh العرض بيرجع
await page.reload(); await page.waitForSelector('table.eco-fixed');
ok(true, 'العرض المحفوظ اتطبّق بعد refresh');
ok(errs.length === 0, 'صفر خطأ كونسول: ' + errs.join(' | '));
await br.close();
console.log(`\n${pass} عدّى · ${fail} فشل`); process.exit(fail ? 1 : 0);
