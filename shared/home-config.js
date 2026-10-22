// ══════════════════════════════════════════════════════════════
// shared/home-config.js — إعداد الشاشة الرئيسية لهب المخزن
// ══════════════════════════════════════════════════════════════
//
// 🔴 **ده الملف اللي بيفرّق رئيسية المخزن عن رئيسية الشحن** — البناء والجلب والكاش وعمر الرقم وطي
//    الأقسام وشريط «خلص» كلهم في `shared/home.js` (متطابق بالبايت في الهبّين). هنا بس: الأقسام
//    والصفوف والأدوات. ترتيب التحميل: `hub-config.js` ← `core.js` ← `gates.js` ← `home.js` ← `home-config.js`.
//
// 🔴 **الأقسام الخمسة (قرار أحمد 22-10-2026):** تجهيز الأوردر (طباعة · تغليف) · التسليمات (بوسطة · مكتب) ·
//    المرتجعات (الرجوع للمخزن · مرتجعات بوسطة) · أدوات مساعدة (عطلان · باركود) · أدوات أخرى (الجرد · الإحصائيات).
//    «مرتجعات بوسطة» **صف مش كارت** — بس مالها طابور ولا عدّاد (الأداة سكانر استلام بلا endpoint عدّ)،
//    فالصف `link: true`: الرقم `—` رمادي وزرار «فتح الأداة ←» مكان التحديث. ⛔ ممنوع رقم مفتعل.
//    لو اتقرر عدّاد حقيقي: محتاج endpoint جديد في `bosta-orders-returned-scanner` + Promote — قرار منفصل.
//
// 🔴 **الاشتقاق كله من `shared/gates.js`** — `ecoChannelOf` · `ecoChannelGate` · `ecoCourierGroup` · `ecoOfficeGate` ·
//    `ecoWarehouseGate`. الصفحة بتنادي **نفس** الدوال على **نفس** الرد اللي الرقم هنا بيتحسب منه — نسخة تانية
//    من القاعدة هنا = الرئيسية تقول ٦٦ والصفحة تفتح على ٦ (درس R1 · v1.11.0). ⛔ ممنوع أي حساب أهلية هنا.
// ⚠️ **`derive` واحدة للشبكة وللكاش.** والكاش خام.
// ⚠️ **صفحات الطباعة والتغليف بتكتب نفس الكاش** (`ECO_CACHE_PRINT`/`ECO_CACHE_PACK`) بعد كل جلب — فبتفتح على
//    بيانات أحدث بدل شاشة فاضية. 🔴 و`allZones: true` في جلب الطباعة **لازم يطابق** اللي `Order-Printer.html` بتبعته.

// ─── «خلص النهارده / أمس» — إيه اللي بيتعدّ «اتعمل» لكل أداة ───
function doneExtra(e) {
  if (!e || !e.extra) return {};
  if (typeof e.extra === 'object') return e.extra;
  try { return JSON.parse(e.extra) || {}; } catch { return {}; }
}
// الطباعة: فاتورة (S1/S2) أو بوليصة (AWB). `not_found` ما اتطبعش، ونتيجة `error` فشل.
// 🔴 `extra.result` في الطباعة **كائن** (`{status}`) مش نص زي التغليف — راجع `stats.html`.
function donePickPrint(e) {
  if (!['S1', 'S2', 'AWB'].includes(e.type)) return false;
  const r = doneExtra(e).result;
  return !(r && typeof r === 'object' && r.status === 'error');
}
// التسليم: `update` بنتيجة success/warning. `already` و`rejected` مش «اتسلّم».
function donePickShip(e) {
  return e.type === 'update' && ['success', 'warning'].includes(doneExtra(e).result);
}

// 🔴 طابور الطباعة: التقسيمة **بالقناة** (مناديب · بوسطة · شو روم) — اللي الموظف بيتصرّف عليه (ورق وطابعة مختلفين).
//    العدّ على **نفس بوابة `Order-Printer.html` بالحرف**. المستبعَد **بيتعدّ وبيتقال** في مربع لوحده — مش
//    بيختفي في صمت. 🔴 الإجمالي = **اللي ينفع يتطبع دلوقتي**، مش طول المصفوفة (أوردر ما اترفعش على بوسطة
//    مالوش بوليصة). المربعات التلاتة الأخيرة بتظهر **بس لما يكون فيها فعلاً**.
function derivePrint(data) {
  const orders = data.orders || [];
  const n = { invoice: 0, awb: 0, showroom: 0, none: 0, pending: 0, s2Hold: 0 };
  for (const o of orders) {
    const chan = ecoChannelOf(o);
    const gate = ecoChannelGate(o, chan);
    if (gate === 'not-uploaded') { n.pending++; continue; }
    if (gate === 's2')           { n.s2Hold++;  continue; }
    n[chan]++;
  }
  // 🎨 §HOME-CHIPS: القنوات التلاتة «مجموعة موصولة» (`grp`)، و«في انتظار الرفع» بادج ⏳ على خانة بوسطة
  //    (`att`) مش مربع لوحده. ⚠️ المربعات الشاذة (مؤجّل · بلا منطقة) كبسولات لوحدها جنب المجموعة.
  const chips = [
    { grp: true, cls: 'chip-ch-invoice',  label: 'مناديب', n: n.invoice },
    { grp: true, cls: 'chip-ch-awb',      label: 'بوسطة',  n: n.awb, att: { n: n.pending, title: 'في انتظار الرفع على بوسطة' } },
    { grp: true, cls: 'chip-ch-showroom', label: 'شو روم', n: n.showroom },
  ];
  return { total: n.invoice + n.awb + n.showroom + n.none, chips };
}
// 🔴 طابور التغليف: التقسيمة **بالمندوب** (بوسطة · شو روم · مناديب) — نفس مربعات `Orders-Packing-Checker.html`،
//    والعدّ من `ecoCourierCounts` (نفس القاعدة بالحرف).
function derivePack(data) {
  const orders = data.orders || [];
  const cn = ecoCourierCounts(orders);
  return { total: data.total ?? orders.length,
           chips: ECO_COURIER_GROUPS.map(g => ({ grp: true, cls: g.cls, label: g.label, n: cn[g.key] })) };
}

// 🔴 «رفع بوسطة» — نفس صف هب الشحن والتحصيل بالحرف (الصفحة `Bosta-Orders-Upload.html` متطابقة في الهبّين): التلات أوضاع
//    بالتوازي على نفس الـ Worker، والعدّ بنفس شرط تاب «الرفع» جوّه الأداة (`!alreadyUploaded`). ⚠️ لو أي وضع فشل
//    الصف كله بيقول فشل (بيسمّي الوضع) — رقم إجمالي ناقص وضع شكله سليم وهو أقل من الحقيقة. 🔴 والكاش عدّادات بس
//    (`bostaCacheSet` في `core.js` — مفتاحه `ECO_CACHE_BOSTA_UPLOAD` مش كاش تسليمات بوسطة) وصفحة الأداة بتكتب فيه هي
//    كمان مع كل جلب لأي وضع. ⚠️ والنداءات قراءة بحتة (`fetch_candidates` بطّل يكتب).
//    🔴 مفتاح الصف `bostaUpload` مش `bosta` — ده محجوز لـ«جاهز لتسليم بوسطة».
const BOSTA_MODES = [
  { key: 's1',       label: '🚚 شحن عادي', cls: 'qc-job-s1' },
  { key: 'return',   label: '↩️ استرجاع',  cls: 'qc-job-return' },
  { key: 'exchange', label: '🔄 استبدال',  cls: 'qc-job-exchange' },
];
function deriveBosta(counts) {
  const chips = BOSTA_MODES.map(m => ({ grp: true, cls: m.cls, label: m.label, n: counts[m.key] }));   // 🎨 مجموعة موصولة (§HOME-CHIPS)
  return { total: chips.reduce((a, c) => a + c.n, 0), chips };
}

const ECO_HOME = {
  staggerMs: 200,     // 🔴 الخمس Workers بتشارك نفس الـ Custom App — فاصل بين إطلاق كل طابور (قرار أحمد 19-09-2026)
  sections: [
    { id: 'Prep', cls: 'sec-prep', summary: true, svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>`,
      title: 'قسم تجهيز الأوردر', sub: 'رفع وطباعة وتغليف', queues: ['bostaUpload', 'print', 'pack'] },
    { id: 'Deliver', cls: 'sec-deliver', summary: true, svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h12M12 6l6 6-6 6"/></svg>`,
      title: 'قسم التسليمات', sub: 'بوسطة والمكتب', queues: ['bosta', 'office'] },
    { id: 'Returns', cls: 'sec-returns', summary: true, svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`,
      title: 'قسم المرتجعات', sub: 'رجوع للمخزن ومرتجعات بوسطة', queues: ['warehouse', 'returnItems', 'bostaReturns'] },
    { id: 'Helper', cls: 'sec-tools', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>`,
      title: 'أدوات مساعدة', sub: 'عطلان وباركود',
      tools: [
        // 🔴 ثيم أحمر (`tool-danger`) — الأداة دي **هدّامة**: بتحذف بند من أوردر حي، وبند متحذف **مالوش رجعة**.
        //    الاسم بيقول الحالة اللي بتودّي ليها («عطلان؟») عشان الموظف اللي جاي من الجدول يلاقي نفس الكلمة.
        { href: 'Order-Item-Remover.html', theme: 'tool-danger', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6"/></svg>`, name: 'عطلان؟ احذف المنتج من الأوردر' },
        { href: 'Order-SKU-Barcode-Printer.html', ico: 'ico-blue', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14"/></svg>`, name: 'باركود SKU' },
      ] },
    { id: 'Other', cls: 'sec-tools', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>`,
      title: 'أدوات أخرى', sub: 'الجرد والإحصائيات',
      tools: [
        // جرد المخزون بيتقرا ويتعمل على الرف في وقت لوحده — ⚠️ بس هو **بيكتب** (تعديل رصيد على شوبيفاي).
        { href: 'Inventory-Audit-Updater.html', ico: 'ico-green', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M9 12h6M9 16h4"/></svg>`, name: 'جرد المخزون' },
        { href: 'stats.html', ico: 'ico-purple', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></svg>`, name: 'إحصائيات المخزن' },
      ] },
  ],
  queues: {
    // 🔴 «رفع بوسطة» أول صف في «تجهيز الأوردر» — الرفع على بوسطة **شرط قبل** طباعة البوليصة (`ecoChannelGate` → `not-uploaded`)،
    //    فعلامة ⏳ «في انتظار الرفع» على خانة بوسطة في صف الطباعة هي الطلب اللي الصف ده بيحلّه.
    bostaUpload: {
      href: 'Bosta-Orders-Upload.html', idCls: 'id-upload',
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>`,
      name: 'رفع بوسطة', code: 'لم يتم الرفع',
      err: 'تعذّر جلب أوردرات رفع بوسطة',
      async fetch() {
        const api = ecoApi(ECO_WORKERS.bostaUpload);
        const s = getSession();
        const get = {
          s1:       () => api.apiGet('get_orders'),
          return:   () => api.apiPost('fetch_candidates', { jobType: 'return',   employee: s?.username || null }),
          exchange: () => api.apiPost('fetch_candidates', { jobType: 'exchange', employee: s?.username || null }),
        };
        const res = await Promise.allSettled(BOSTA_MODES.map(m => get[m.key]()));
        const failed = BOSTA_MODES.filter((m, i) => res[i].status === 'rejected');
        // ⚠️ الوضع اللي نجح بيتكتب في الكاش حتى لو غيره فشل — رقمه صح.
        const counts = {};
        BOSTA_MODES.forEach((m, i) => {
          if (res[i].status !== 'fulfilled') return;
          counts[m.key] = (res[i].value.rows || []).filter(r => !r.alreadyUploaded).length;
          bostaCacheSet(m.key, counts[m.key]);
        });
        if (failed.length) {
          const first = res.find(r => r.status === 'rejected').reason;
          throw new Error(`تعذّر جلب ${failed.map(m => m.label).join(' · ')} — ${first?.message || 'خطأ غير معروف'}`);
        }
        return deriveBosta(counts);
      },
      fromCache() {
        const c = bostaCacheGet();
        if (!cacheFresh(c)) return null;
        return { at: new Date(c.at), r: deriveBosta(c.counts) };
      },
    },
    print: {
      href: 'Order-Printer.html', idCls: 'id-print', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>`,
      name: 'جاهز للطباعة', code: 'فواتير مستنية الطباعة',
      err: 'تعذّر جلب طابور الطباعة',
      done: { verb: 'اتطبع', worker: 'printer', pick: donePickPrint },
      ...ecoRawQueue({
        cacheKey: ECO_CACHE_PRINT,
        fetchRaw: () => ecoApi(ECO_WORKERS.printer).apiPath('/orders', { allZones: true }),
        derive: derivePrint,
      }),
    },
    pack: {
      href: 'Orders-Packing-Checker.html', idCls: 'id-pack', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>`,
      name: 'جاهز للتغليف', code: 'اتطبع ولسه ما اتغلّفش',
      err: 'تعذّر جلب طابور التغليف',
      done: { verb: 'اتغلّف', worker: 'pack', pick: e => e.type === 'packed' },
      ...ecoRawQueue({
        cacheKey: ECO_CACHE_PACK,
        fetchRaw: () => ecoApi(ECO_WORKERS.pack).apiGet('get_ready_orders'),
        derive: derivePack,
      }),
    },
    // 🔴 «جاهز لتسليم بوسطة» — **الشروط كلها في الـ Worker** (`get_ready_to_ship` · v3.5.0)، و`Bosta-Orders-Shipped-Scanner.html`
    //    بتنادي **نفس** الـ endpoint — الرقم هنا والقايمة هناك من مصدر واحد. ⛔ ممنوع أي حساب أهلية هنا.
    //    ⚠️ بلا مربعات بقرار أحمد — الرقم المتغلّف بس، من غير أي ذكر للمستبعَد.
    bosta: {
      href: 'Bosta-Orders-Shipped-Scanner.html', idCls: 'id-deliver', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
      name: 'جاهز لتسليم بوسطة', code: 'اتطبع واتغلّف ومستني بوسطة',
      err: 'تعذّر جلب طابور تسليمات بوسطة',
      // `types`/`results` فلاتر server-side بتقلّل الصفحات بس — الحكم النهائي في `pick`.
      done: { verb: 'اتسلّم لبوسطة', worker: 'shipped', params: { types: 'update', results: 'success,warning' }, pick: donePickShip },
      ...ecoRawQueue({
        cacheKey: ECO_CACHE_BOSTA,
        fetchRaw: () => ecoApi(ECO_WORKERS.shipped).apiGet('get_ready_to_ship'),
        derive: data => ({ total: data.counts?.total ?? (data.orders || []).length, chips: [] }),
      }),
    },
    // 🔴 «جاهز للتسليم للمكتب» — الـ Worker بيرجّع الـ Ready خام والأهلية في `ecoOfficeGate` (`gates.js`)؛ و`Package-Transfer-To-Office.html`
    //    بتنادي **نفس الدالة** على **نفس الرد**. (`package_whereabouts_s1` مش قابل للفلترة في بحث شوبيفاي.)
    office: {
      href: 'Package-Transfer-To-Office.html', idCls: 'id-office', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4h14v17"/><path d="M9 21v-4h6v4M9 8h2M13 8h2M9 12h2M13 12h2"/></svg>`,
      name: 'جاهز للتسليم للمكتب', code: 'اتغلّف ولسه في المخزن',
      err: 'تعذّر جلب طابور تسليمات المكتب',
      ...ecoRawQueue({
        cacheKey: ECO_CACHE_OFFICE,
        fetchRaw: () => ecoApi(ECO_WORKERS.office).apiGet('get_ready_to_office'),
        derive: data => ({ total: ecoOfficeQueue(data.orders || []).length, chips: [] }),
      }),
    },
    // 🔴 «جاهز للرجوع للمخزن» — نفس عقد صف المكتب بالحرف، ومعكوسه في الإلغاء (هناك الملغي مستبعَد، هنا مؤهل).
    //    ⚠️ بلا مربعات تقسيمة — «مرتجع» و«ملغي» بيتفرقوا في **الصفحة** (عمود الحالة).
    warehouse: {
      href: 'Package-Transfer-To-Warehouse.html', idCls: 'id-warehouse', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-6 9 6v9H3z"/><path d="M12 17v-5M9.5 14.5L12 12l2.5 2.5"/></svg>`,
      name: 'جاهز للرجوع للمخزن', code: 'مرتجع أو ملغي ولسه ما اترجّعش',
      err: 'تعذّر جلب طابور استلام المرتجعات',
      ...ecoRawQueue({
        cacheKey: ECO_CACHE_WAREHOUSE,
        fetchRaw: () => ecoApi(ECO_WORKERS.warehouse).apiGet('get_ready_to_warehouse'),
        derive: data => ({ total: ecoWarehouseQueue(data.orders || []).length, chips: [] }),
      }),
    },
    // 🔴 «قطع مستنية الرجوع للمخزن» (v1.51.0 · صف لوحده بقرار أحمد 22-10-2026) — من دفتر D1
    //    `warehouse_return_items` (Worker استلام المرتجعات · `get_return_items`). الرقم = القطع المستنية
    //    (التسليم الجزئي — الأوردر بيفضل `Shipped` فعمره ما بيظهر في الصف اللي فوق) + الناقصة من أوردرات
    //    اتسلّمت ناقصة. ⚠️ الوحدة **قطعة** مش أوردر. وصفر شوبيفاي في الجلب ده (D1 بس).
    returnItems: {
      href: 'Package-Transfer-To-Warehouse.html#riBox', idCls: 'id-retitems', unit: 'قطعة', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>`,
      name: 'قطع مستنية الرجوع للمخزن', code: 'تسليم جزئي · قطع ناقصة',
      err: 'تعذّر جلب دفتر القطع الراجعة',
      ...ecoRawQueue({
        cacheKey: ECO_CACHE_RETURN_ITEMS,
        fetchRaw: () => ecoApi(ECO_WORKERS.warehouse).apiGet('get_return_items'),
        derive: data => {
          const p = data.counts?.pending || 0, m = data.counts?.missing || 0;
          return { total: p + m, truncated: !!data.truncated, chips: [
            { cls: 'qc-ri-pending', label: 'تسليم جزئي', n: p, grp: true },
            { cls: 'qc-ri-missing', label: 'ناقصة', n: m, grp: true },
          ] };
        },
      }),
    },
    // 🔴 «مرتجعات بوسطة» — صف **بلا طابور** (`link: true`): مفيش عدّاد ولا تحديث. الأداة **هدّامة**
    //    (`orderCancel` بلا رجعة) — تأكيدها جوّه الصفحة نفسها.
    bostaReturns: {
      href: 'Bosta-Orders-Returned-Scanner.html', idCls: 'id-bostaret', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>`,
      name: 'مرتجعات بوسطة', code: 'سكانر استلام الراجع',
      link: true,
    },
  },
};
