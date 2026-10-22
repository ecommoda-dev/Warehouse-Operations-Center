// ══════════════════════════════════════════════════════════════
// docs/bosta-table-check.mjs — فحص جدولَي «رفع بوسطة» (v1.34.0 · html-builder v8.3.1)
//
// 🔴 فحص متصفح فعلي بـWorker وهمي لـ`Bosta-Orders-Upload.html`: الفلاتر في رأس العمود (قمع · قايمة عائمة
//    · chips · tooltip · بحث/تاريخ · مسح الكل وسط الـ debounce) · العناوين الثابتة · سحب عرض الأعمدة
//    (سحب · دبل كليك · حفظ · آخر عمود بيمتص الفراغ) · تبديل الوضع · وجدول السجل server-side.
// ⚠️ الملف ده **مش** في `queues-check`/`tools-check` — الأداة دي كانت برّه الفحصين من v1.13.0.
//    خطأ تحميل الموارد الخارجية (الخطوط · ExcelJS) بيتتجاهل — البنود هنا عن الصفحة مش عن الشبكة.
// التشغيل:  npm i playwright --no-save && node docs/bosta-table-check.mjs   (PW_CHROMIUM=… لو لزم)
// ══════════════════════════════════════════════════════════════
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png' };
const server = http.createServer((req,res)=>{ const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('nf');} res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); res.end(fs.readFileSync(f)); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const BASE=`http://127.0.0.1:${server.address().port}`;
let pass=0, fail=0; const is=(c,m,d='')=>{ c?pass++:fail++; console.log(c?'  ✅':'  ❌',m,c?'':d); };
const browser = await chromium.launch({ args:['--no-sandbox'], ...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{}) });

const prov=['Cairo','Giza','Alexandria','Giza','Cairo','Menofia','Sharqia','Giza','Cairo','Dakahlia'];
const modes=['district','zone','province','ambiguous','district','cityDoubt','district','zone','district','district'];
const rows=prov.map((p,i)=>({ orderId:String(1000+i), orderNumber:'#'+(59600+i), customer:'عميل '+i+' اسم طويل جدا جدا', phone:'0100000000'+i,
  province:p, addressCity:'مدينة '+i, address1:'شارع '+i+' عنوان طويل شوية للاختبار', address2:'', createdAt:new Date(Date.UTC(2026,9,11-i%3,10)).toISOString(),
  s1: i%4===0?'Confirmed + Edit':'Confirmed', addressOk:true, uploadable:true, mode:modes[i], ambiguous:modes[i]==='ambiguous', cityDoubt:modes[i]==='cityDoubt',
  candidates:[{districtId:'d1',name:'A'},{districtId:'d2',name:'B'}], zoneName:'Z', zoneId:'z'+i, districtName:'D'+i, districtId:'d'+i, cityId:'c'+i, cityName:p, cityNameAr:'', alreadyUploaded:false, problems:[] }));
const logs=Array.from({length:30},(_,i)=>({ timestamp:new Date(Date.UTC(2026,9,10,8,i)).toISOString(), employee:i%2?'Ahmed_Ibraheem':'Sara', type:i%5?'uploaded':'skipped',
  order_name:'#'+(59000+i), order_id:String(900+i), notes:'ملاحظة '+i, extra:JSON.stringify({result:'success',tracking_number:'85672163'+i,contract_used:'documented',district_sent:'Dokki'}) }));
const calls=[];
async function mk(){
  const ctx=await browser.newContext({ viewport:{width:1500,height:900} }); const page=await ctx.newPage(); const errs=[];
  page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{ if(m.type()==='error'&&!/ERR_TUNNEL|net::ERR/.test(m.text())) errs.push('c:'+m.text()); });
  await page.addInitScript(()=>{ sessionStorage.setItem('woc_session',JSON.stringify({v:1,username:'Ahmed_Ibraheem',displayName:'Ahmed Ibraheem',loginAt:'2026-10-11T08:00:00.000Z'})); localStorage.setItem('warehouse_ops_worker_secret','S'); });
  await page.route('**/*.workers.dev/**', async route=>{
    const u=new URL(route.request().url()); const a=u.searchParams.get('action'); calls.push({a,q:Object.fromEntries(u.searchParams)});
    let body={ ok:true, success:true, version:'99.0.0', checks:[], entries:[], employees:[], total:0 };
    if(a==='get_orders') body={...body, rows, filterGuard:{checked:true,consistent:true}, catalogLoaded:true};
    if(a==='fetch_candidates') body={...body, rows:[], catalogLoaded:true};
    if(a==='get_logs'){ let e=logs; const s=u.searchParams.get('search'); if(s) e=e.filter(x=>x.order_name.includes(s)||x.notes.includes(s)); const t=u.searchParams.get('types'); if(t) e=e.filter(x=>t.split(',').includes(x.type)); body={...body, entries:e}; }
    if(a==='get_logs_count'){ let e=logs; const s=u.searchParams.get('search'); if(s) e=e.filter(x=>x.order_name.includes(s)||x.notes.includes(s)); const t=u.searchParams.get('types'); if(t) e=e.filter(x=>t.split(',').includes(x.type)); body={...body,total:e.length}; }
    await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
  });
  return {ctx,page,errs};
}
const {page,errs}=await mk();
await page.goto(BASE+'/Bosta-Orders-Upload.html'); await page.waitForSelector('#tblBody tr:not(.empty-row)',{timeout:8000});
await page.waitForTimeout(600);
const rowsN=()=>page.$$eval('#tblBody tr:not(.empty-row)',t=>t.length);
const cnt=()=>page.$eval('#filteredCount',e=>e.textContent.trim());
console.log('\n── جدول الرفع ──');
is(await rowsN()===10,'10 صفوف اترسمت');
is(await page.$('.flt-header')===null,'هيدر لوحة الفلاتر اتشال');
is(await page.$eval('#fltState',e=>getComputedStyle(e).display)==='none','حامل الحالة مخفي');
const funnels=await page.$$eval('#tblMain thead .th-flt',b=>b.map(x=>x.dataset.hflt));
is(JSON.stringify(funnels)==='["search","date","province","addrMode","s1"]','5 قمع في الأعمدة الصح: '+funnels);
// sticky
const sticky=await page.$eval('#tblMain thead th',e=>{const c=getComputedStyle(e);return [c.position,c.backgroundColor!=='rgba(0, 0, 0, 0)',c.fontSize,c.fontWeight]});
is(sticky[0]==='sticky'&&sticky[1],'العناوين sticky ولها خلفية',JSON.stringify(sticky));
is(sticky[2]==='12px'&&sticky[3]==='700','خط العنوان 12/700',JSON.stringify(sticky));
const wrapCss=await page.$eval('#tblWrap',e=>getComputedStyle(e).overflowY+'/'+getComputedStyle(e).maxHeight);
is(wrapCss.startsWith('auto'),'سكرول داخلي على #tblWrap: '+wrapCss);
// colgroup + handles
const cols=await page.$$eval('#tblMain colgroup col',c=>c.map(x=>parseInt(x.style.width)));
const hn=await page.$$eval('#tblMain .col-rz',h=>h.length);
const thn=await page.$$eval('#tblMain thead th',h=>h.length);
is(cols.length===thn&&cols.every(w=>w>=36),'colgroup بعروض لكل عمود: '+cols.join(','));
is(hn===thn-1,'مقبض لكل عمود ما عدا الـ checkbox: '+hn);
const fit=await page.evaluate(()=>{const t=document.getElementById('tblMain'),w=document.getElementById('tblWrap');return [t.scrollWidth,w.clientWidth]});
is(fit[0]<=fit[1]+1,'الجدول مالي الكارت من غير سكرول أفقي: '+fit);
// province filter via funnel
await page.click('#tblMain .th-flt[data-hflt="province"]');
is(await page.$('.hpop')!==null,'قايمة المحافظة اتفتحت');
await page.click('.hpop [data-hval="Giza"]');
is(await page.$('.hpop')!==null,'القايمة فضلت مفتوحة بعد أول اختيار (#32)');
is(await cnt()==='3','فلتر Giza = 3 ('+await cnt()+')');
await page.click('.hpop [data-hval="Cairo"]');
is(await cnt()==='6','Giza+Cairo = 6 ('+await cnt()+')');
is(await page.$eval('#tblMain th[data-fk="province"] .th-cnt',e=>e.textContent)==='2','عدّاد القمع = 2');
is((await page.$$eval('#chipsRow-province .ms-chip',c=>c.length))===2,'2 chips تحت صف النتائج');
const zone=await page.$eval('#chipsRow-province',e=>e.closest('.chips-zone')&&!!e.closest('.tbl-body-wrap')===false);
is(zone,'الـ chips خارج الجدول وتحت صف النتائج');
// tooltip
await page.keyboard.press('Escape'); is(await page.$('.hpop')===null,'Esc بيقفل القايمة');
await page.hover('#tblMain .th-flt[data-hflt="province"]'); await page.waitForTimeout(100);
const tip=await page.$eval('.th-tip',e=>e.textContent).catch(()=>null);
is(tip&&tip.includes('Giza')&&tip.includes('Cairo'),'tooltip بالقيم المحددة: '+tip);
await page.mouse.move(5,5);
await page.hover('#tblMain .th-flt[data-hflt="s1"]'); await page.waitForTimeout(100);
is(await page.$('.th-tip')===null,'مفيش tooltip لو مفيش اختيار');
// addrMode chips box <-> funnel sync
await page.click('#clearAllBtn'); await page.waitForTimeout(100);
is(await cnt()==='10','مسح كل الفلاتر → 10');
is(await page.$eval('#clearAllBtn',e=>e.classList.contains('inactive')),'زرار المسح باهت');
// sort independent
await page.click('#tblMain th[data-col="date"]'); is(await page.$eval('#tblMain th[data-col="date"]',e=>e.classList.contains('sorted')),'ضغط اسم العمود = ترتيب');
is(await page.$('.hpop')===null,'ترتيب مافتحش قايمة');
await page.click('#tblMain .th-flt[data-hflt="date"]');
is(await page.$('.hpop')!==null&&await page.$eval('.hpop',e=>e.classList.contains('wide')),'قايمة التاريخ 340');
is(await page.$eval('#tblMain th[data-col="date"]',e=>e.classList.contains('sorted')),'فتح القمع ما لمسش الترتيب');
// date popup within bounds
const bounds=await page.evaluate(()=>{const p=document.querySelector('.hpop').getBoundingClientRect();return [...document.querySelectorAll('.hpop input[type=date],.hpop select')].every(i=>{const r=i.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1})});
is(bounds,'حقول التاريخ جوّه حدود القايمة');
await page.click('.hpop [data-hpreset="today"]'); await page.waitForTimeout(100);
is(await page.$eval('#tblMain th[data-fk="date"]',e=>e.classList.contains('flt-on')),'فترة سريعة بتلوّن القمع');
is((await page.$$eval('#chipsSpecial .ms-chip',c=>c.map(x=>x.textContent)))[0].includes('اليوم'),'chip التاريخ باسم الفترة');
await page.fill('.hpop [data-hdate="from"]','2026-10-09'); await page.fill('.hpop [data-hdate="to"]','2026-10-10');
await page.waitForTimeout(100);
const chip=(await page.$$eval('#chipsSpecial .ms-chip',c=>c.map(x=>x.textContent)))[0]||'';
is(chip.includes('09/10/2026')&&chip.includes('10/10/2026'),'chip بصيغة dd/mm/yyyy: '+chip);
is(await page.$eval('.hpop [data-hpreset="today"]',e=>!e.classList.contains('on')),'تعديل من/إلى شال الفترة السريعة');
await page.selectOption('.hpop [data-hmonth]','9'); await page.selectOption('.hpop [data-hyear]','2026'); await page.waitForTimeout(100);
is((await page.$$eval('#chipsSpecial .ms-chip',c=>c.map(x=>x.textContent)))[0].includes('سبتمبر 2026'),'شهر محدد');
await page.click('.hpop [data-hact="dclear"]'); await page.waitForTimeout(100);
is(await cnt()==='10'&&await page.$('#chipsSpecial .ms-chip')===null,'✕ مسح الاختيار للتاريخ');
await page.keyboard.press('Escape');
// search
await page.click('#tblMain .th-flt[data-hflt="search"]');
await page.type('#hSearchInput','59603'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
is(await page.$('.hpop')===null,'Enter قفل القايمة');
is(await cnt()==='1','البحث بقى والفلتر فضل: '+await cnt());
is((await page.$eval('#chipsSpecial',e=>e.textContent)).includes('59603'),'chip البحث');
// type & close fast (debounce race)
await page.click('#clearAllBtn'); await page.waitForTimeout(50);
await page.click('#tblMain .th-flt[data-hflt="search"]'); await page.type('#hSearchInput','عميل 7'); await page.mouse.click(5,300);
await page.waitForTimeout(450);
is(await cnt()==='1','كتابة وقفل أسرع من الـ debounce اتثبّتت: '+await cnt());
await page.click('#tblMain .th-flt[data-hflt="search"]');
is(await page.$eval('#hSearchInput',e=>e.value)==='عميل 7','المربع بيتفتح على القيمة المطبّقة');
await page.keyboard.press('Escape');
await page.click('#clearAllBtn'); await page.waitForTimeout(500);
is(await cnt()==='10','مسح الكل وسط/بعد debounce مارجّعش البحث: '+await cnt());
// quick clear race
await page.click('#tblMain .th-flt[data-hflt="search"]'); await page.type('#hSearchInput','xyz'); await page.click('#clearAllBtn'); await page.waitForTimeout(600);
is(await cnt()==='10','مسح كل الفلاتر وسط الـ debounce: '+await cnt());
// zero results keeps table
await page.click('#tblMain .th-flt[data-hflt="search"]'); await page.type('#hSearchInput','لا يوجد'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
is(await page.$('#tblMain thead')!==null&&await page.$eval('#tblMain tbody .empty-row td',e=>e.colSpan>1),'صفر نتائج: الجدول وعناوينه ظاهرين والرسالة صف جواه');
await page.click('#clearAllBtn'); await page.waitForTimeout(200);
// addr chips box above -> funnel
await page.evaluate(()=>msToggleItem('addrMode','district')); await page.waitForTimeout(100);
is(await page.$eval('#tblMain th[data-fk="addrMode"]',e=>e.classList.contains('flt-on')),'اختيار من مربعات حالة العنوان بيولّع القمع');
await page.click('#clearAllBtn');
// ── تأكيد «المحافظة فقط» من الجدول + autofocus نافذة المنطقة (v1.37.0) ──
console.log('\n── تأكيد المحافظة فقط · autofocus ──');
{
  const tr=n=>`#tblBody tr:has-text("#${n}")`;
  const btn=n=>page.$(`${tr(n)} .prov-confirm-btn`);
  const modeCell=n=>page.$eval(tr(n),e=>e.querySelector('.badge')?.className||'');
  is(!!await btn(59602),'صف «المحافظة فقط» عليه زرار تأكيد');
  is(await (await btn(59602)).evaluate(e=>e.textContent.includes('تأكيد')),'نص الزرار «تأكيد»');
  is(await (await btn(59602)).evaluate(e=>!e.hasAttribute('title')),'الزرار من غير tooltip');
  const others=await page.$$eval('#tblBody .prov-confirm-btn',b=>b.length);
  is(others===1,'الزرار على الصف المقصود بس ('+others+')');
  is(await page.$(`${tr(59603)} .prov-confirm-btn`)===null,'صف «أكتر من مطابقة» ما فيهوش زرار');
  is((await modeCell(59602)).includes('badge-warn'),'البادج أصفر قبل التأكيد');
  const uploadableBefore=await page.evaluate(()=>rowUploadable(allRows.find(r=>r.orderId==='1002')));
  is(uploadableBefore===false,'الصف موقوف عن الرفع قبل التأكيد');
  await (await btn(59602)).click(); await page.waitForTimeout(150);
  is(await page.$eval('#districtOverlay',e=>!e.classList.contains('open')),'ضغط التأكيد ما فتحش نافذة المنطقة');
  is(await page.evaluate(()=>JSON.stringify(districtOverride['1002']))==='{"forceProvince":true}','كتب {forceProvince:true} بالظبط (نفس زرار النافذة)');
  is(await page.evaluate(()=>rowUploadable(allRows.find(r=>r.orderId==='1002'))),'الصف بقى قابل للرفع');
  is((await modeCell(59602)).includes('badge-success'),'البادج بقى أخضر');
  is(await page.$(`${tr(59602)} .prov-confirm-btn`).then(b=>b.evaluate(e=>e.textContent.includes('تراجع'))),'ظهر زرار «تراجع»');
  is(await rowsN()===10,'الصف فضل في الجدول');
  // تراجع
  await (await btn(59602)).click(); await page.waitForTimeout(150);
  is(await page.evaluate(()=>districtOverride['1002']===undefined),'التراجع مسح التثبيت');
  is((await modeCell(59602)).includes('badge-warn')&&(await (await btn(59602)).evaluate(e=>e.textContent.includes('تأكيد'))),'رجع أصفر وزرار «تأكيد»');
  // لو التثبيت معاه مدينة معدّلة — مفيش تراجع
  await page.evaluate(()=>{ districtOverride['1002']={forceProvince:true,cityId:'cX',cityName:'X'}; applyFilters(); });
  await page.waitForTimeout(100);
  is(await page.$(`${tr(59602)} .prov-confirm-btn`)===null,'تثبيت معاه مدينة معدّلة: مفيش زرار تراجع');
  await page.evaluate(()=>{ delete districtOverride['1002']; applyFilters(); }); await page.waitForTimeout(100);
  // autofocus
  await page.evaluate(()=>openDistrictPicker('1002')); await page.waitForTimeout(250);
  is(await page.evaluate(()=>document.activeElement&&document.activeElement.id)==='dpSearch','أول ما النافذة تفتح الفوكس على مربع البحث');
  await page.keyboard.type('abc'); await page.waitForTimeout(50);
  is(await page.$eval('#dpSearch',e=>e.value)==='abc','الكتابة على الكيبورد دخلت مربع البحث على طول');
  await page.evaluate(()=>closeDistrictPicker());
  // فتح من الزرار في الجدول (مش من الـ API) بيفوكس برضه
  await page.click(`${tr(59602)} .zone-empty`); await page.waitForTimeout(250);
  is(await page.evaluate(()=>document.activeElement&&document.activeElement.id)==='dpSearch','الفتح من زرار الجدول بيفوكس على البحث');
  await page.evaluate(()=>closeDistrictPicker()); await page.waitForTimeout(100);
}
// resize drag
const before=await page.$$eval('#tblMain colgroup col',c=>c.map(x=>parseInt(x.style.width)));
const h=await page.$('#tblMain .col-rz[data-rz="customer"]'); const bb=await h.boundingBox();
await page.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2); await page.mouse.down(); await page.mouse.move(bb.x+bb.width/2-80,bb.y+bb.height/2,{steps:6}); await page.mouse.up();
const after=await page.$$eval('#tblMain colgroup col',c=>c.map(x=>parseInt(x.style.width)));
const ci=await page.$$eval('#tblMain thead th',t=>t.findIndex(x=>x.dataset.col==='customer'));
is(after[ci]-before[ci]===80,'سحب 80px لليسار = +80 بالظبط ('+(after[ci]-before[ci])+')');
is(await page.$('.hpop')===null&&await page.$eval('#tblMain th[data-col="customer"]',e=>!e.classList.contains('sorted')),'السحب ما فتحش قايمة ولا رتّب');
const saved=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('dco_col_widths')));
is(saved.length===1&&saved[0].endsWith('_main_s1'),'العرض اتحفظ بمفتاح وضع الشحن: '+saved);
await page.dblclick('#tblMain .col-rz[data-rz="customer"]');
const fitW=await page.$$eval('#tblMain colgroup col',c=>c.map(x=>parseInt(x.style.width)))[ci];
const afterFit=(await page.$$eval('#tblMain colgroup col',c=>c.map(x=>parseInt(x.style.width))))[ci];
is(afterFit<after[ci],'دبل كليك بيصغّر كمان: '+after[ci]+' → '+afterFit);
// last col fills card
const gap=await page.evaluate(()=>{const t=document.getElementById('tblMain'),w=document.getElementById('tblWrap');return w.clientWidth-t.getBoundingClientRect().width});
// نصغّر عمود بالسحب لليمين → الجدول لازم يفضل مالي الكارت (آخر عمود بيمتص الفراغ)
{ const hh=await page.$('#tblMain .col-rz[data-rz="shopifyAddr"]'); const b2=await hh.boundingBox();
  await page.mouse.move(b2.x+b2.width/2,b2.y+b2.height/2); await page.mouse.down(); await page.mouse.move(b2.x+b2.width/2+150,b2.y+b2.height/2,{steps:6}); await page.mouse.up(); }
const gap2=await page.evaluate(()=>{const t=document.getElementById('tblMain'),w=document.getElementById('tblWrap');return w.clientWidth-t.getBoundingClientRect().width});
is(Math.abs(gap2)<=2,'بعد تصغير عمود مفيش فراغ بعد آخر عمود: '+gap2);
// refresh keeps widths
await page.click('.act-btn.refresh >> nth=0'); await page.waitForTimeout(500);
const re=(await page.$$eval('#tblMain colgroup col',c=>c.map(x=>parseInt(x.style.width))))[ci];
is(re===afterFit,'العرض بيفضل بعد refresh: '+re);
// sticky behavior with scroll: add many rows? check thead top stays
// sticky under scroll
await page.evaluate(()=>{ const c=allRows.map((r,i)=>({...r,orderId:'x'+i,orderNumber:'#7'+i})); allRows=allRows.concat(c,c.map(r=>({...r,orderId:r.orderId+'b',orderNumber:r.orderNumber+'b'}))); applyFilters(); });
await page.waitForTimeout(200);
const sc=await page.evaluate(()=>{const w=document.getElementById('tblWrap'); w.scrollTop=400; const th=document.querySelector('#tblMain thead th').getBoundingClientRect(), wr=w.getBoundingClientRect(); return [w.scrollHeight>w.clientHeight, Math.abs(th.top-wr.top)<=1]});
is(sc[0]&&sc[1],'العناوين بتفضل فوق جوّه سكرول الجدول (scroll=400)',JSON.stringify(sc));
// job switch
await page.click('#jobBtn-return'); await page.waitForTimeout(600);
const funR=await page.$$eval('#tblMain thead .th-flt',b=>b.map(x=>x.dataset.hflt));
is(!funR.includes('s1'),'وضع الاسترجاع: مفيش قمع حالة (مفيش عمود): '+funR);
const colsR=await page.$$eval('#tblMain colgroup col',c=>c.length), thR=await page.$$eval('#tblMain thead th',c=>c.length);
is(colsR===thR||colsR===0,'colgroup اتبنى من جديد لأعمدة الوضع: '+colsR+'/'+thR);
await page.click('#jobBtn-s1'); await page.waitForTimeout(600);
// log tab
console.log('\n── جدول السجل ──');
await page.click('#tabLog'); await page.waitForSelector('#logTblBody tr:not(.empty-row)'); await page.waitForTimeout(500);
const lf=await page.$$eval('#tblLog thead .th-flt',b=>b.map(x=>x.dataset.hflt));
is(JSON.stringify(lf)==='["date","logEmp","logType","search"]','قمع السجل: '+lf);
is(await page.$$eval('#tblLog colgroup col',c=>c.length)===10,'colgroup السجل');
await page.click('#tblLog .th-flt[data-hflt="logType"]'); await page.click('.hpop [data-hval="skipped"]'); await page.waitForTimeout(400);
const lastGet=[...calls].reverse().find(c=>c.a==='get_logs');
is(lastGet.q.types==='skipped','فلتر النوع اتبعت للسيرفر (types=skipped)');
is(await page.$('.hpop')!==null,'قايمة السجل فضلت مفتوحة');
is(await page.$eval('#logFilteredCount',e=>e.textContent.trim())==='6','النتائج 6 من السيرفر: '+await page.$eval('#logFilteredCount',e=>e.textContent.trim()));
await page.keyboard.press('Escape');
await page.click('#tblLog .th-flt[data-hflt="search"]'); await page.type('#hSearchInput','59005'); await page.mouse.click(5,300); await page.waitForTimeout(300);
const g2=[...calls].reverse().find(c=>c.a==='get_logs');
is(g2.q.search==='59005','بحث السجل اتثبّت عند القفل السريع: '+g2.q.search);
await page.click('#logClearAllBtn'); await page.waitForTimeout(300);
const g3=[...calls].reverse().find(c=>c.a==='get_logs');
is(!g3.q.search&&!g3.q.types,'مسح كل فلاتر السجل');
await page.click('#tblLog th[data-col="employee"]'); await page.waitForTimeout(200);
const g4=[...calls].reverse().find(c=>c.a==='get_logs');
is(g4.q.sortBy==='employee','ترتيب السجل لسه server-side');
const savedLog=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('dco_col_widths')));
is(true,'مفاتيح التخزين: '+savedLog.join(','));
// switching tabs closes popup
await page.click('#tblLog .th-flt[data-hflt="logEmp"]'); await page.click('#tabMain'); 
is(await page.$('.hpop')===null,'تغيير التاب قفل القايمة');
// ── بنود خاصة بهب المخزن (الصفحة نسخة متطابقة بالبايت مع هب الشحن — اللي بيختلف جاي من hub-config/core) ──
is((await page.title()).includes('رفع بوسطة') && (await page.title()).includes('مركز عمليات المخزن'),'عنوان التاب باسم مركز المخزن (ECO_HUB.name)',await page.title());
is(await page.evaluate(()=>ECO_HUB.isBusy()===false),'حارس الدفعة: ECO_HUB.isBusy() = false وقت الراحة');
is(await page.evaluate(()=>{ uploadRunning=true; const b=ECO_HUB.isBusy(); uploadRunning=false; return b; }),'🔴 والخروج التلقائي موقوف وقت الرفع: ECO_HUB.isBusy() = true لما uploadRunning');
const auths=[]; page.on('request',r=>{ if(/workers\.dev/.test(r.url())&&r.method()!=='OPTIONS') auths.push(r.headers()['authorization']); });
await page.reload(); await page.waitForSelector('#tblBody tr:not(.empty-row)',{timeout:8000}); await page.waitForTimeout(500);
const SEC=await page.evaluate(()=>localStorage.getItem('warehouse_ops_worker_secret'));
is(auths.length>0&&SEC&&auths.every(a=>a==='Bearer '+SEC),'🔴 كل النداءات بسر مجموعة المخزن بالظبط',JSON.stringify(auths.slice(0,2)));
is(await page.evaluate(()=>getSecret()===localStorage.getItem('warehouse_ops_worker_secret')),'السر من مفتاح المخزن `warehouse_ops_worker_secret`');
is(await page.evaluate(()=>ecoSession.username==='Ahmed_Ibraheem' && !!sessionStorage.getItem('woc_session') && !sessionStorage.getItem('dco_session')),'الجلسة من `woc_session` بس');
is(errs.length===0,'صفر أخطاء كونسول',errs.join(' | '));
console.log(`\n${pass} ✅  ${fail} ❌`); await browser.close(); server.close(); process.exit(fail?1:0);
